import { mat4 } from 'gl-matrix';
import vtkAbstractMapper from 'vtk.js/Sources/Rendering/Core/AbstractMapper';

/**
 * 
 */
interface IAbstractMapper3DInitialValues {
	bounds?: number[];
	center?: number[];
}

export interface vtkAbstractMapper3D extends vtkAbstractMapper {
	/**
     * Get the bounds for this mapper as [xmin, xmax, ymin, ymax,zmin, zmax].
	 * @default 0
	 * @return {Number[]} The bounds for the mapper.
	 */
	getBounds(): number[];

		
	/**
	 * Get the center of this mapper’s data.
	 * @return {Number[]} The center of the mapper's data.
	 */
	getCenter(): number[];
		
	/**
	 * Get the diagonal length of this mappers bounding box.
	 * @return {Number} The diagonal length of mapper bounding box.
	 */
	getLength(): number;
		
	/**
	 * Get the ith clipping plane as a homogeneous plane equation.
	 * Use getNumberOfClippingPlanes() to get the number of planes.
	 * @param {mat4} propMatrix 
	 * @param {Number} i
	 * @param {Number[]} hnormal 
	 */
	getClippingPlaneInDataCoords(propMatrix : mat4, i : number, hnormal : number[]): void;
}

/**
 * Method use to decorate a given object (publicAPI+model) with vtkAbstractMapper3D characteristics.
 *
 * @param publicAPI object on which methods will be bounds (public)
 * @param model object on which data structure will be bounds (protected)
 * @param {IAbstractMapper3DInitialValues} [initialValues] (default: {})
 */
export function extend(publicAPI: object, model: object, initialValues?: IAbstractMapper3DInitialValues): void;

/**
 * vtkAbstractMapper3D is an abstract class to specify interface between 3D
 * data and graphics primitives or software rendering techniques. Subclasses
 * of vtkAbstractMapper3D can be used for rendering geometry or rendering
 * volumetric data.
 * 
 * This class also defines an API to support hardware clipping planes (at most
 * six planes can be defined). It also provides geometric data about the input
 * data it maps, such as the bounding box and center.
 */
export declare const vtkAbstractMapper3D: {
    extend: typeof extend,
};
export default vtkAbstractMapper3D;
