import { mat3, mat4 } from 'gl-matrix';

import macro from 'vtk.js/Sources/macro';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
// import * as vtkMath from 'vtk.js/Sources/Common/Core/Math';
// import vtkWebGPUTexture from 'vtk.js/Sources/Rendering/WebGPU/Texture';
import vtkProperty from 'vtk.js/Sources/Rendering/Core/Property';
import vtkTexture from 'vtk.js/Sources/Rendering/Core/Texture';
import vtkWebGPUBufferManager from 'vtk.js/Sources/Rendering/WebGPU/BufferManager';
import vtkWebGPUPipeline from 'vtk.js/Sources/Rendering/WebGPU/Pipeline';
import vtkWebGPUSampler from 'vtk.js/Sources/Rendering/WebGPU/Sampler';
import vtkWebGPUShaderCache from 'vtk.js/Sources/Rendering/WebGPU/ShaderCache';
import vtkWebGPUShaderDescription from 'vtk.js/Sources/Rendering/WebGPU/ShaderDescription';
import vtkWebGPUUniformBuffer from 'vtk.js/Sources/Rendering/WebGPU/UniformBuffer';
import vtkWebGPUVertexInput from 'vtk.js/Sources/Rendering/WebGPU/VertexInput';
import vtkViewNode from 'vtk.js/Sources/Rendering/SceneGraph/ViewNode';

const { BufferUsage, PrimitiveTypes } = vtkWebGPUBufferManager;
const { Representation } = vtkProperty;
const { ScalarMode } = vtkMapper;
// const { Filter, Wrap } = vtkWebGPUTexture;
const StartEvent = { type: 'StartEvent' };
const EndEvent = { type: 'EndEvent' };

const vtkWebGPUPolyDataVS = `
//VTK::Renderer::UBO

//VTK::Mapper::UBO

//VTK::VertexInput

//VTK::PositionVC::Dec

//VTK::Color::Dec

//VTK::Normal::Dec

//VTK::TCoord::Dec

[[builtin(position)]] var<out> Position : vec4<f32>;
[[builtin(vertex_index)]] var<in> my_index: u32;

[[stage(vertex)]]
fn main() -> void
{
  var vertex: vec4<f32> = vertexMC;

  //VTK::PositionVC::Impl

  //VTK::Color::Impl

  //VTK::Normal::Impl

  //VTK::TCoord::Impl

  Position = rendererUBO.WCDCMatrix*vertexMC;
  return;
}
`;

const vtkWebGPUPolyDataFS = `
//VTK::Renderer::UBO

//VTK::Mapper::UBO

//VTK::Color::Dec

// optional surface normal declaration
//VTK::Normal::Dec

//VTK::TCoord::Dec

//VTK::PositionVC::Dec

//VTK::RenderEncoder::Dec

[[builtin(front_facing)]] var<in> frontFacing : bool;

[[stage(fragment)]]
fn main() -> void
{
  var ambientColor: vec4<f32> = mapperUBO.AmbientColor;
  var diffuseColor: vec4<f32> = mapperUBO.DiffuseColor;
  var opacity: f32 = mapperUBO.Opacity;

  //VTK::PositionVC::Impl

  //VTK::Color::Impl

  //VTK::Normal::Impl

  //VTK::Light::Impl

  var computedColor: vec4<f32> = vec4<f32>(ambientColor.rgb * mapperUBO.AmbientIntensity
     + diffuse * mapperUBO.DiffuseIntensity
     + specular * mapperUBO.SpecularIntensity,
     opacity);

  //VTK::TCoord::Impl

  if (computedColor.a == 0.0) { discard; };

  //VTK::RenderEncoder::Impl
}
`;

// ----------------------------------------------------------------------------
// vtkWebGPUPolyDataMapper methods
// ----------------------------------------------------------------------------

function vtkWebGPUPolyDataMapper(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkWebGPUPolyDataMapper');

  publicAPI.buildPass = (prepass) => {
    if (prepass) {
      model.WebGPUActor = publicAPI.getFirstAncestorOfType('vtkWebGPUActor');
      model.WebGPURenderer = model.WebGPUActor.getFirstAncestorOfType(
        'vtkWebGPURenderer'
      );
      model.WebGPURenderWindow = model.WebGPURenderer.getParent();
      model.device = model.WebGPURenderWindow.getDevice();
    }
  };

  // Renders myself
  publicAPI.translucentPass = (prepass) => {
    if (prepass) {
      publicAPI.render();
    }
  };

  publicAPI.opaquePass = (prepass) => {
    if (prepass) {
      publicAPI.render();
    }
  };

  publicAPI.updateUBO = () => {
    // make sure the data is up to date
    const actor = model.WebGPUActor.getRenderable();
    const ppty = actor.getProperty();
    const utime = model.UBO.getSendTime();
    if (
      publicAPI.getMTime() > utime ||
      ppty.getMTime() > utime ||
      model.renderable.getMTime() > utime
    ) {
      let aColor = ppty.getAmbientColorByReference();
      model.UBO.setValue('AmbientIntensity', ppty.getAmbient());
      model.UBO.setArray('AmbientColor', [
        aColor[0],
        aColor[1],
        aColor[2],
        1.0,
      ]);
      model.UBO.setValue('DiffuseIntensity', ppty.getDiffuse());
      aColor = ppty.getDiffuseColorByReference();
      model.UBO.setArray('DiffuseColor', [
        aColor[0],
        aColor[1],
        aColor[2],
        1.0,
      ]);
      model.UBO.setValue('SpecularIntensity', ppty.getSpecular());
      model.UBO.setValue('SpecularPower', ppty.getSpecularPower());
      aColor = ppty.getSpecularColorByReference();
      model.UBO.setArray('SpecularColor', [
        aColor[0],
        aColor[1],
        aColor[2],
        1.0,
      ]);
      model.UBO.setValue('Opacity', ppty.getOpacity());

      const device = model.WebGPURenderWindow.getDevice();
      model.UBO.sendIfNeeded(device, device.getMapperBindGroupLayout());
    }
  };

  publicAPI.render = () => {
    publicAPI.invokeEvent(StartEvent);
    if (!model.renderable.getStatic()) {
      model.renderable.update();
    }
    model.currentInput = model.renderable.getInputData();
    publicAPI.invokeEvent(EndEvent);

    model.renderEncoder = model.WebGPURenderer.getRenderEncoder();

    publicAPI.buildPrimitives();

    // update descriptor sets
    publicAPI.updateUBO();
  };

  publicAPI.generateShaderDescriptions = (hash, pipeline, vertexInput) => {
    // standard shader stuff most paths use
    let code = vtkWebGPUPolyDataVS;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Renderer::UBO', [
      model.WebGPURenderer.getUBOCode(),
    ]).result;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Mapper::UBO', [
      model.UBO.getShaderCode(),
    ]).result;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::VertexInput', [
      vertexInput.getShaderCode(),
    ]).result;
    const vDesc = vtkWebGPUShaderDescription.newInstance({
      type: 'vertex',
      hash,
      code,
    });

    code = vtkWebGPUPolyDataFS;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Renderer::UBO', [
      model.WebGPURenderer.getUBOCode(),
    ]).result;
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Mapper::UBO', [
      model.UBO.getShaderCode(),
    ]).result;

    const fDesc = vtkWebGPUShaderDescription.newInstance({
      type: 'fragment',
      hash,
      code,
    });

    const sdrs = pipeline.getShaderDescriptions();
    sdrs.push(vDesc);
    sdrs.push(fDesc);

    // different things we deal with in building the shader code
    publicAPI.replaceShaderColor(hash, pipeline, vertexInput);
    publicAPI.replaceShaderNormal(hash, pipeline, vertexInput);
    // publicAPI.replaceShaderLight(hash, pipeline);
    publicAPI.replaceShaderTCoord(hash, pipeline, vertexInput);
    // publicAPI.replaceShaderPositionVC(hash, pipeline);
    model.renderEncoder.replaceShaderCode(pipeline);
  };

  publicAPI.replaceShaderNormal = (hash, pipeline, vertexInput) => {
    if (vertexInput.hasAttribute('normalMC')) {
      const vDesc = pipeline.getShaderDescription('vertex');
      let code = vDesc.getCode();
      code = vtkWebGPUShaderCache.substitute(code, '//VTK::Normal::Dec', [
        vDesc.getOutputDeclaration('vec3<f32>', 'normalVC'),
      ]).result;

      code = vtkWebGPUShaderCache.substitute(code, '//VTK::Normal::Impl', [
        '  normalVC = (rendererUBO.WCVCNormals * normalMC).xyz;',
      ]).result;
      vDesc.setCode(code);

      const fDesc = pipeline.getShaderDescription('fragment');
      code = fDesc.getCode();

      code = vtkWebGPUShaderCache.substitute(code, '//VTK::Normal::Dec', [
        fDesc.getInputDeclaration(vDesc, 'normalVC'),
      ]).result;

      code = vtkWebGPUShaderCache.substitute(code, '//VTK::Normal::Impl', [
        '  var normal: vec3<f32> = normalVC;',
        '  if (!frontFacing) { normal = -normal; }',
        '  var df: f32  = max(0.0, normal.z);',
        '  var sf: f32 = pow(df, mapperUBO.SpecularPower);',
        '  var diffuse: vec3<f32> = df * diffuseColor.rgb;',
        '  var specular: vec3<f32> = sf * mapperUBO.SpecularColor.rgb * mapperUBO.SpecularColor.a;',
      ]).result;
      fDesc.setCode(code);
    } else {
      const fDesc = pipeline.getShaderDescription('fragment');
      let code = fDesc.getCode();
      code = vtkWebGPUShaderCache.substitute(code, '//VTK::Normal::Impl', [
        '  var diffuse: vec3<f32> = diffuseColor.rgb;',
        '  var specular: vec3<f32> = mapperUBO.SpecularColor.rgb * mapperUBO.SpecularColor.a;',
      ]).result;
      fDesc.setCode(code);
    }
  };

  publicAPI.replaceShaderColor = (hash, pipeline, vertexInput) => {
    if (!vertexInput.hasAttribute('colorVI')) return;

    const vDesc = pipeline.getShaderDescription('vertex');

    let code = vDesc.getCode();
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Color::Dec', [
      vDesc.getOutputDeclaration('vec4<f32>', 'color'),
    ]).result;

    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Color::Impl', [
      '  color = colorVI;',
    ]).result;
    vDesc.setCode(code);

    const fDesc = pipeline.getShaderDescription('fragment');
    code = fDesc.getCode();
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Color::Dec', [
      fDesc.getInputDeclaration(vDesc, 'color'),
    ]).result;

    code = vtkWebGPUShaderCache.substitute(code, '//VTK::Color::Impl', [
      'ambientColor = color;',
      'diffuseColor = color;',
      'opacity = mapperUBO.Opacity*color.a;',
    ]).result;
    fDesc.setCode(code);
  };

  publicAPI.replaceShaderTCoord = (hash, pipeline, vertexInput) => {
    if (!vertexInput.hasAttribute('tcoord')) return;

    const vDesc = pipeline.getShaderDescription('vertex');

    let code = vDesc.getCode();
    code = vtkWebGPUShaderCache.substitute(code, '//VTK::TCoord::Dec', [
      vDesc.getOutputDeclaration('vec2<f32>', 'tcoordVS'),
    ]).result;

    code = vtkWebGPUShaderCache.substitute(code, '//VTK::TCoord::Impl', [
      '  tcoordVS = tcoord;',
    ]).result;
    vDesc.setCode(code);

    const fDesc = pipeline.getShaderDescription('fragment');
    code = fDesc.getCode();
    const tcinput = [fDesc.getInputDeclaration(vDesc, 'tcoordVS')];

    for (let t = 0; t < model.textures.length; t++) {
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

    if (model.textures.length) {
      code = vtkWebGPUShaderCache.substitute(code, '//VTK::TCoord::Impl', [
        'var tcolor: vec4<f32> = textureSample(Texture0, Sampler0, tcoordVS);',
        'computedColor = computedColor*tcolor;',
      ]).result;
    }
    fDesc.setCode(code);
  };

  publicAPI.getUsage = (rep, i) => {
    if (rep === Representation.POINTS || i === 0) {
      return BufferUsage.Verts;
    }

    if (i === 1) {
      return BufferUsage.Lines;
    }

    if (rep === Representation.WIREFRAME) {
      if (i === 2) {
        return BufferUsage.LinesFromTriangles;
      }
      return BufferUsage.LinesFromStrips;
    }

    if (i === 2) {
      return BufferUsage.Triangles;
    }

    return BufferUsage.Strips;
  };

  publicAPI.getHashFromUsage = (usage) => `pt${usage}`;

  publicAPI.getTopologyFromUsage = (usage) => {
    switch (usage) {
      case BufferUsage.Triangles:
        return 'triangle-list';
      case BufferUsage.Verts:
        return 'point-list';
      default:
      case BufferUsage.Lines:
        return 'line-list';
    }
  };

  publicAPI.buildVertexInput = (pd, cells, primType) => {
    const actor = model.WebGPUActor.getRenderable();
    const representation = actor.getProperty().getRepresentation();
    const device = model.WebGPURenderWindow.getDevice();

    const vertexInput = model.primitives[primType].vertexInput;

    // hash = all things that can change the values on the buffer
    // since mtimes are unique we can use
    // - cells mtime - because cells drive how we pack
    // - rep (point/wireframe/surface) - again because of packing
    // - relevant dataArray mtime - the source data
    // - shift - not currently captured
    // - scale - not currently captured
    // - format
    // - usage
    // - packExtra - covered by format
    // - prim type (vert/lines/polys/strips) - covered by cells mtime

    const hash = cells.getMTime() + representation;
    // points
    const points = pd.getPoints();
    if (points) {
      const buffRequest = {
        hash: hash + points.getMTime(),
        dataArray: points,
        source: points,
        cells,
        primitiveType: primType,
        representation,
        time: Math.max(points.getMTime(), cells.getMTime()),
        usage: BufferUsage.PointArray,
        format: 'float32x4',
        packExtra: true,
      };
      const buff = device.getBufferManager().getBuffer(buffRequest);
      vertexInput.addBuffer(buff, ['vertexMC']);
    } else {
      vertexInput.removeBufferIfPresent('vertexMC');
    }

    // normals, only used for surface rendering
    const usage = publicAPI.getUsage(representation, primType);
    if (usage === BufferUsage.Triangles || usage === BufferUsage.Strips) {
      const normals = pd.getPointData().getNormals();
      const buffRequest = {
        cells,
        representation,
        primitiveType: primType,
        format: 'snorm8x4',
        packExtra: true,
        shift: 0,
        scale: 127,
      };
      if (normals) {
        buffRequest.hash = hash + normals.getMTime();
        buffRequest.dataArray = normals;
        buffRequest.source = normals;
        buffRequest.time = Math.max(normals.getMTime(), cells.getMTime());
        buffRequest.usage = BufferUsage.PointArray;
        const buff = device.getBufferManager().getBuffer(buffRequest);
        vertexInput.addBuffer(buff, ['normalMC']);
      } else if (primType === PrimitiveTypes.Triangles) {
        buffRequest.hash = hash + points.getMTime();
        buffRequest.dataArray = points;
        buffRequest.source = points;
        buffRequest.time = Math.max(points.getMTime(), cells.getMTime());
        buffRequest.usage = BufferUsage.NormalsFromPoints;
        const buff = device.getBufferManager().getBuffer(buffRequest);
        vertexInput.addBuffer(buff, ['normalMC']);
      } else {
        vertexInput.removeBufferIfPresent('normalMC');
      }
    }

    // deal with colors but only if modified
    let haveColors = false;
    if (model.renderable.getScalarVisibility()) {
      const c = model.renderable.getColorMapColors();
      if (c) {
        const scalarMode = model.renderable.getScalarMode();
        let haveCellScalars = false;
        // We must figure out how the scalars should be mapped to the polydata.
        if (
          (scalarMode === ScalarMode.USE_CELL_DATA ||
            scalarMode === ScalarMode.USE_CELL_FIELD_DATA ||
            scalarMode === ScalarMode.USE_FIELD_DATA ||
            !pd.getPointData().getScalars()) &&
          scalarMode !== ScalarMode.USE_POINT_FIELD_DATA &&
          c
        ) {
          haveCellScalars = true;
        }
        const buffRequest = {
          hash: hash + points.getMTime(),
          dataArray: c,
          source: c,
          cells,
          primitiveType: primType,
          representation,
          time: Math.max(c.getMTime(), cells.getMTime()),
          usage: BufferUsage.PointArray,
          format: 'unorm8x4',
          cellData: haveCellScalars,
          cellOffset: 0,
        };
        const buff = device.getBufferManager().getBuffer(buffRequest);
        vertexInput.addBuffer(buff, ['colorVI']);
        haveColors = true;
      }
    }
    if (!haveColors) {
      vertexInput.removeBufferIfPresent('colorVI');
    }

    let tcoords = null;
    if (
      model.renderable.getInterpolateScalarsBeforeMapping() &&
      model.renderable.getColorCoordinates()
    ) {
      tcoords = model.renderable.getColorCoordinates();
    } else {
      tcoords = pd.getPointData().getTCoords();
    }
    if (tcoords) {
      const buffRequest = {
        hash: hash + tcoords.getMTime(),
        dataArray: tcoords,
        source: tcoords,
        cells,
        primitiveType: primType,
        representation,
        time: Math.max(tcoords.getMTime(), cells.getMTime()),
        usage: BufferUsage.PointArray,
        format: 'float32x2',
      };
      const buff = device.getBufferManager().getBuffer(buffRequest);
      vertexInput.addBuffer(buff, ['tcoord']);
    } else {
      vertexInput.removeBufferIfPresent('tcoord');
    }
  };

  publicAPI.updateTextures = () => {
    // we keep track of new and used textures so
    // that we can clean up any unused textures so we don't hold onto them
    const usedTextures = [];
    const newTextures = [];

    // do we have a scalar color texture
    const idata = model.renderable.getColorTextureMap(); // returns an imagedata
    if (idata) {
      if (!model.colorTexture) {
        model.colorTexture = vtkTexture.newInstance();
      }
      model.colorTexture.setInputData(idata);
      newTextures.push(model.colorTexture);
    }

    // actor textures?
    const actor = model.WebGPUActor.getRenderable();
    const textures = actor.getTextures();
    for (let i = 0; i < textures.length; i++) {
      if (textures[i].getInputData()) {
        newTextures.push(textures[i]);
      }
      if (textures[i].getImage() && textures[i].getImageLoaded()) {
        newTextures.push(textures[i]);
      }
    }

    for (let i = 0; i < newTextures.length; i++) {
      const srcTexture = newTextures[i];
      const treq = {
        source: srcTexture,
        usage: 'vtk',
      };
      const newTex = model.device.getTextureManager().getTexture(treq);
      if (newTex.getReady()) {
        // is this a new texture
        let found = false;
        for (let t = 0; t < model.textures.length; t++) {
          if (model.textures[t] === newTex) {
            found = true;
            usedTextures[t] = true;
          }
        }
        if (!found) {
          usedTextures[model.textures.length] = true;
          model.textures.push(newTex);

          const newSamp = vtkWebGPUSampler.newInstance();
          const interpolate = srcTexture.getInterpolate()
            ? 'linear'
            : 'nearest';
          newSamp.create(model.device, {
            magFilter: interpolate,
            minFilter: interpolate,
          });
          model.samplers.push(newSamp);
          const newBG = model.device.getHandle().createBindGroup({
            layout: model.device.getTextureBindGroupLayout(),
            entries: [
              {
                binding: 0,
                resource: newTex.getHandle().createView(),
              },
              {
                binding: 1,
                resource: newSamp.getHandle(),
              },
            ],
          });
          model.textureBindGroups.push(newBG);
        }
      }
    }

    // remove unused textures
    for (let i = model.textures.length - 1; i >= 0; i--) {
      if (!usedTextures[i]) {
        model.textures.splice(i, 1);
        model.samplers.splice(i, 1);
        model.textureBindGroups.splice(i, 1);
      }
    }
  };

  // compute a unique hash for a pipeline, this needs to be unique enough to
  // capture any pipeline code changes (which includes shader changes)
  // or vertex input changes/ bind groups/ etc
  publicAPI.computePipelineHash = (vertexInput, usage) => {
    let pipelineHash = 'pd';
    if (vertexInput.hasAttribute(`normalMC`)) {
      pipelineHash += `n`;
    }
    if (vertexInput.hasAttribute(`colorVI`)) {
      pipelineHash += `c`;
    }
    if (vertexInput.hasAttribute(`tcoord`)) {
      pipelineHash += `t`;
    }
    if (model.textures.length) {
      pipelineHash += `tx${model.textures.length}`;
    }
    const uhash = publicAPI.getHashFromUsage(usage);
    pipelineHash += uhash;
    pipelineHash += model.renderEncoder.getPipelineHash();

    return pipelineHash;
  };

  // was originally buildIBOs() but not using IBOs right now
  publicAPI.buildPrimitives = () => {
    const poly = model.currentInput;
    const prims = [
      poly.getVerts(),
      poly.getLines(),
      poly.getPolys(),
      poly.getStrips(),
    ];

    const device = model.WebGPURenderWindow.getDevice();

    model.renderable.mapScalars(poly, 1.0);

    // handle textures
    publicAPI.updateTextures();

    // handle per primitive type
    for (let i = PrimitiveTypes.Points; i <= PrimitiveTypes.Triangles; i++) {
      if (prims[i].getNumberOfValues() > 0) {
        const actor = model.WebGPUActor.getRenderable();
        const rep = actor.getProperty().getRepresentation();
        const usage = publicAPI.getUsage(rep, i);

        const primHelper = model.primitives[i];
        publicAPI.buildVertexInput(model.currentInput, prims[i], i);
        const pipelineHash = publicAPI.computePipelineHash(
          primHelper.vertexInput,
          usage
        );
        let pipeline = device.getPipeline(pipelineHash);

        // build VBO for this primitive
        // build the pipeline if needed
        if (!pipeline) {
          pipeline = vtkWebGPUPipeline.newInstance();
          pipeline.addBindGroupLayout(
            device.getRendererBindGroupLayout(),
            `RendererUBO`
          );
          pipeline.addBindGroupLayout(
            device.getMapperBindGroupLayout(),
            `MapperUBO`
          );
          // add texture BindGroupLayouts
          for (let t = 0; t < model.textures.length; t++) {
            pipeline.addBindGroupLayout(
              device.getTextureBindGroupLayout(),
              `Texture${t}`
            );
          }
          publicAPI.generateShaderDescriptions(
            pipelineHash,
            pipeline,
            primHelper.vertexInput
          );
          pipeline.setTopology(publicAPI.getTopologyFromUsage(usage));
          pipeline.setRenderEncoder(model.renderEncoder);
          pipeline.setVertexState(
            primHelper.vertexInput.getVertexInputInformation()
          );
          device.createPipeline(pipelineHash, pipeline);
        }

        if (pipeline) {
          model.WebGPURenderer.registerPipelineCallback(
            pipeline,
            primHelper.renderForPipeline
          );
        }
      }
    }
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  colorTexture: null,
  renderEncoder: null,
  textures: null,
  samplers: null,
  textureBindGroups: null,
  VBOBuildTime: 0,
  VBOBuildString: null,
  primitives: null,
  tmpMat4: null,
  lightColor: [], // used internally
  lightHalfAngle: [], // used internally
  lightDirection: [], // used internally
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkViewNode.extend(publicAPI, model, initialValues);

  model.tmpMat3 = mat3.identity(new Float64Array(9));
  model.tmpMat4 = mat4.identity(new Float64Array(16));

  model.UBO = vtkWebGPUUniformBuffer.newInstance();
  model.UBO.setBinding(0);
  model.UBO.setGroup(1);
  model.UBO.setName('mapperUBO');
  model.UBO.addEntry('MCVCMatrix', 'mat4x4<f32>');
  model.UBO.addEntry('AmbientColor', 'vec4<f32>');
  model.UBO.addEntry('DiffuseColor', 'vec4<f32>');
  model.UBO.addEntry('AmbientIntensity', 'f32');
  model.UBO.addEntry('DiffuseIntensity', 'f32');
  model.UBO.addEntry('SpecularColor', 'vec4<f32>');
  model.UBO.addEntry('SpecularIntensity', 'f32');
  model.UBO.addEntry('Opacity', 'f32');
  model.UBO.addEntry('SpecularPower', 'f32');

  //   [[offset(0)]] MCVCMatrix: mat4x4<f32>;
  //   [[offset(64)]] normalMatrix: mat4x4<f32>;
  //   [[offset(192)]] Metallic: f32;
  //   [[offset(196)]] Roughness: f32;
  //   [[offset(200)]] EmissiveFactor: f32;

  model.samplers = [];
  model.textures = [];
  model.textureBindGroups = [];
  model.primitives = [];
  for (let i = PrimitiveTypes.Start; i < PrimitiveTypes.End; i++) {
    model.primitives[i] = {
      primitiveType: i,
      vertexInput: vtkWebGPUVertexInput.newInstance(),
    };
    const primHelper = model.primitives[i];
    model.primitives[i].renderForPipeline = (pipeline) => {
      const renderEncoder = model.WebGPURenderer.getRenderEncoder();

      // bind the mapper UBO
      renderEncoder.setBindGroup(1, model.UBO.getBindGroup());

      // bind any textures and samplers
      for (let t = 0; t < model.textures.length; t++) {
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
    };
  }

  // Build VTK API
  macro.setGet(publicAPI, model, ['context', 'renderEncoder', 'UBO']);

  model.VBOBuildTime = {};
  macro.obj(model.VBOBuildTime, { mtime: 0 });

  // Object methods
  vtkWebGPUPolyDataMapper(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkWebGPUPolyDataMapper');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
