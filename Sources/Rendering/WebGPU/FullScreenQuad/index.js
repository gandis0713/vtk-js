import macro from 'vtk.js/Sources/macro';
import vtkWebGPUPipeline from 'vtk.js/Sources/Rendering/WebGPU/Pipeline';
import vtkWebGPUSampler from 'vtk.js/Sources/Rendering/WebGPU/Sampler';
import vtkWebGPUShaderCache from 'vtk.js/Sources/Rendering/WebGPU/ShaderCache';
import vtkWebGPUShaderDescription from 'vtk.js/Sources/Rendering/WebGPU/ShaderDescription';
import vtkWebGPUVertexInput from 'vtk.js/Sources/Rendering/WebGPU/VertexInput';
import vtkViewNode from 'vtk.js/Sources/Rendering/SceneGraph/ViewNode';

const vtkWebGPUFSQVS = `
//VTK::VertexInput

//VTK::TCoord::Dec

[[builtin(position)]] var<out> Position : vec4<f32>;
[[builtin(vertex_index)]] var<in> my_index: u32;

[[stage(vertex)]]
fn main() -> void
{
  Position = vec4<f32>(vertexMC, 1.0);
  tcoordVS = vec2<f32>(vertexMC.x * 0.5 + 0.5, 1.0 - vertexMC.y * 0.5 - 0.5);
  return;
}
`;

// default frag shader just copies texture
const vtkWebGPUFSQFS = `
//VTK::TCoord::Dec

//VTK::RenderEncoder::Dec

[[stage(fragment)]]
fn main() -> void
{
  var computedColor: vec4<f32> = textureSample(Texture0, Sampler0, tcoordVS);

  //VTK::RenderEncoder::Impl
}
`;

// ----------------------------------------------------------------------------
// vtkWebGPUFullScreenQuad methods
// ----------------------------------------------------------------------------

function vtkWebGPUFullScreenQuad(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkWebGPUFullScreenQuad');

  publicAPI.generateShaderDescriptions = (hash, pipeline, vertexInput) => {
    // standard shader stuff most paths use
    let code = model.vertexShaderTemplate;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::VertexInput', [
      vertexInput.getShaderCode(),
    ]).result;
    const vDesc = vtkWebGPUShaderDescription.newInstance({
      type: 'vertex',
      hash,
      code,
    });

    code = model.fragmentShaderTemplate;
    const fDesc = vtkWebGPUShaderDescription.newInstance({
      type: 'fragment',
      hash,
      code,
    });

    const sdrs = pipeline.getShaderDescriptions();
    sdrs.push(vDesc);
    sdrs.push(fDesc);

    // different things we deal with in building the shader code
    publicAPI.replaceShaderTCoord(hash, pipeline, vertexInput);
  };

  publicAPI.replaceShaderTCoord = (hash, pipeline, vertexInput) => {
    const vDesc = pipeline.getShaderDescription('vertex');

    let code = vDesc.getCode();
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::TCoord::Dec', [
      vDesc.getOutputDeclaration('vec2<f32>', 'tcoordVS'),
    ]).result;
    vDesc.setCode(code);

    const fDesc = pipeline.getShaderDescription('fragment');
    code = fDesc.getCode();
    const tcinput = [fDesc.getInputDeclaration(vDesc, 'tcoordVS')];

    for (let t = 0; t < model.views.length; t++) {
      const tcount = pipeline.getBindGroupLayoutCount(`Texture${t}`);
      tcinput.push(
        `[[binding(0), group(${tcount})]] var Texture${t}: texture_2d<f32>;`
      );
      tcinput.push(
        `[[binding(1), group(${tcount})]] var Sampler${t}: sampler;`
      );
    }

    code = vtkWebGPUShaderCache.substitute(code, '//VTK::TCoord::Dec', tcinput)
      .result;

    fDesc.setCode(code);
  };

  publicAPI.setTextureViews = (views) => {
    for (let i = 0; i < views.length; i++) {
      const newView = views[i];
      model.views.push(newView);

      const newSamp = vtkWebGPUSampler.newInstance();
      const interpolate = model.interpolate ? 'linear' : 'nearest';
      newSamp.create(model.device, {
        magFilter: interpolate,
        minFilter: interpolate,
      });
      model.samplers.push(newSamp);
      model.viewHandles.push(newView.getHandle());
      const newBG = model.device.getHandle().createBindGroup({
        layout: model.device.getTextureBindGroupLayout(),
        entries: [
          {
            binding: 0,
            resource: newView.getHandle(),
          },
          {
            binding: 1,
            resource: newSamp.getHandle(),
          },
        ],
      });
      model.textureBindGroups.push(newBG);
    }
  };

  // if a texture handle changed then we need to
  // update the bind group
  publicAPI.updateTextureViews = () => {
    for (let i = 0; i < model.views.length; i++) {
      const view = model.views[i];
      if (view.getHandle() !== model.viewHandles[i]) {
        model.viewHandles[i] = view.getHandle();
        const newBG = model.device.getHandle().createBindGroup({
          layout: model.device.getTextureBindGroupLayout(),
          entries: [
            {
              binding: 0,
              resource: view.getHandle(),
            },
            {
              binding: 1,
              resource: model.samplers[i].getHandle(),
            },
          ],
        });
        model.textureBindGroups[i] = newBG;
      }
    }
  };

  publicAPI.render = (renderEncoder, device) => {
    // handle per primitive type
    const primHelper = model.triangles;
    const vertexInput = model.triangles.vertexInput;

    const buff = device.getBufferManager().getFullScreenQuadBuffer();
    vertexInput.addBuffer(buff, ['vertexMC']);

    let pipeline = device.getPipeline(model.pipelineHash);

    publicAPI.updateTextureViews();

    // build VBO for this primitive
    // build the pipeline if needed
    if (!pipeline) {
      pipeline = vtkWebGPUPipeline.newInstance();
      // add texture BindGroupLayouts
      for (let t = 0; t < model.views.length; t++) {
        pipeline.addBindGroupLayout(
          device.getTextureBindGroupLayout(),
          `Texture${t}`
        );
      }
      publicAPI.generateShaderDescriptions(
        model.pipelineHash,
        pipeline,
        primHelper.vertexInput
      );
      renderEncoder.replaceShaderCode(pipeline);
      pipeline.setTopology('triangle-list');
      pipeline.setRenderEncoder(renderEncoder);
      pipeline.setVertexState(
        primHelper.vertexInput.getVertexInputInformation()
      );
      device.createPipeline(model.pipelineHash, pipeline);
    }

    if (pipeline) {
      pipeline.bind(renderEncoder);

      // bind any textures and samplers
      for (let t = 0; t < model.views.length; t++) {
        const tcount = pipeline.getBindGroupLayoutCount(`Texture${t}`);
        renderEncoder.setBindGroup(tcount, model.textureBindGroups[t]);
      }

      // bind the vertex input
      pipeline.bindVertexInput(renderEncoder, primHelper.vertexInput);
      const vbo = primHelper.vertexInput.getBuffer('vertexMC');
      renderEncoder.draw(
        vbo.getSizeInBytes() / vbo.getStrideInBytes(),
        1,
        0,
        0
      );
    }
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  device: null,
  interpolate: true,
  views: null,
  viewHandles: null,
  samplers: null,
  textureBindGroups: null,
  pipelineHash: null,
  fragmentShaderTemplate: null,
  vertexShaderTemplate: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkViewNode.extend(publicAPI, model, initialValues);

  model.samplers = [];
  model.views = [];
  model.viewHandles = [];
  model.textureBindGroups = [];
  model.triangles = {
    primitiveType: 2,
    vertexInput: vtkWebGPUVertexInput.newInstance(),
  };

  model.fragmentShaderTemplate = vtkWebGPUFSQFS;
  model.vertexShaderTemplate = vtkWebGPUFSQVS;

  // Build VTK API
  macro.setGet(publicAPI, model, [
    'context',
    'device',
    'interpolate',
    'pipelineHash',
    'fragmentShaderTemplate',
    'vertexShaderTemplate',
  ]);

  // Object methods
  vtkWebGPUFullScreenQuad(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkWebGPUFullScreenQuad');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
