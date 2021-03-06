import { TypedArray, VtkObject, vtkRange } from "vtk.js/Sources/macro";

/**
 * Output of the rangeHelper instance
 */
interface VtkStatisticInformation {
	min: number;
	max: number;
	count: number;
	sum: number;
	mean: number;
}

/**
 * Helper class used to compute data range of a set of numbers
 */
interface vtkRangeHelper {
	add(value: number): void;
	get(): VtkStatisticInformation;
	getRange(): vtkRange;
}

export interface vtkDataArray extends VtkObject {
	getElementComponentSize(): number;
	/**
	 *
	 * @param tupleIdx
	 * @param componentIndex (default: 0)
	 */
	getComponent(tupleIdx: number, componentIndex: number): number;
	setComponent(tupleIdx: number, componentIndex: number, value: number): void;
	getData(): TypedArray;
	/**
	 * Return the range of the given component.
	 *
	 * @param componentIndex (default: -1)
	 */
	getRange(componentIndex?: number): vtkRange;
	setRange(rangeValue: vtkRange, componentIndex: number): [number, number];
	setTuple(idx: number, tuple: Array<number>): void;
	/**
	 *
	 * @param idx
	 * @param tupleToFill (default [])
	 */
	getTuple(idx: number, tupleToFill?: Array<number>): Array<number>;
	/**
	 *
	 * @param idx (default: 1)
	 */
	getTupleLocation(idx: number): number;
	getNumberOfComponents(): number;
	getNumberOfValues(): number;
	getNumberOfTuples(): number;
	getDataType(): string;
	newClone(): vtkDataArray;
	getName(): string;
	setData: (typedArray: TypedArray, numberOfComponents?: number) => void;
	getState(): object;
	// --- via macro --
	setName: (name: string) => boolean;
	setNumberOfComponents: (numberOfComponents: number) => boolean;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

/**
 * Compute range of a given array. The array could be composed of tuples and
 * individual component range could be computed as well as magnitude.
 *
 * ```
 * const array = [x0, y0, z0, x1, y1, z1, ..., xn, yn, zn];
 * const { min: yMin, max: yMax } = computeRange(array, 1, 3);
 * const { min: minMagnitude, max: maxMagnitude } = computeRange(array, -1, 3);
 * ```
 *
 * @param {Number[]} values Array to go through to extract the range from
 * @param {Number} [component] (default: 0) indice to use inside tuple size
 * @param {Number} [numberOfComponents] (default: 1) size of the tuple
 */
export function computeRange(values: number[], component?: number, numberOfComponents?: number): vtkRange;

/**
 * Create helper object that can be used to gather min, max, count, sum of
 * a set of values.
 */
export function createRangeHelper(): vtkRangeHelper

/**
 * Return the name of a typed array
 *
 * ```
 * const isFloat32 = ('Float32Array' === getDataType(array));
 * const clone = new macro.TYPED_ARRAYS[getDataType(array)](array.length);
 * ```
 *
 * @param typedArray to extract its type from
 */
export function getDataType(typedArray: TypedArray): string

/**
 * Return the max norm of a given vtkDataArray
 *
 * @param dataArray to process
 */
export function getMaxNorm(dataArray: VtkDataArray): number

/**
 * Method use to decorate a given object (publicAPI+model) with vtkDataArray characteristics.
 *
 * @param publicAPI object on which methods will be bounds (public)
 * @param model object on which data structure will be bounds (protected)
 * @param {object} [initialValues] (default: {})
 */
export function extend(publicAPI: object, model: object, initialValues?: object): void;

// ----------------------------------------------------------------------------

/**
 * Method use to create a new instance of vtkDataArray
 * @param {object} [initialValues] for pre-setting some of its content
 */
export function newInstance(initialValues?: object): vtkDataArray;

/**
 * Constants capturing the number of bytes per element based on its data type.
 */
export enum DataTypeByteSize {
	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array,
}

/**
 * Constants capturing the various VTK data types.
 */
export enum VtkDataTypes {
	VOID,
	CHAR,
	SIGNED_CHAR,
	UNSIGNED_CHAR,
	SHORT,
	UNSIGNED_SHORT,
	INT,
	UNSIGNED_INT,
	FLOAT,
	DOUBLE,
}

/**
 * Default vtkDataArray export
 */
export declare const vtkDataArray: {
	newInstance: typeof newInstance,
	extend: typeof extend,
	// static
	computeRange: typeof computeRange,
	createRangeHelper: typeof createRangeHelper,
	getDataType: typeof getDataType,
	getMaxNorm: typeof getMaxNorm,
	// constants
	DataTypeByteSize: typeof DataTypeByteSize,
	VtkDataTypes: typeof VtkDataTypes,
	DefaultDataType: VtkDataTypes,
};

export default vtkDataArray;
