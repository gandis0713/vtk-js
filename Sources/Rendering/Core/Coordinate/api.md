## Introduction

vtkCoordinate represents position in a variety of coordinate systems, and converts position to other coordinate systems. 
It also supports relative positioning, so you can create a cascade of vtkCoordinate objects (no loops please!) that refer to each other.
The typical usage of this object is to set the coordinate system in which to represent a position 
(e.g., SetCoordinateSystemToNormalizedDisplay()), set the value of the coordinate (e.g., SetValue()),
and then invoke the appropriate method to convert to another coordinate system (e.g., GetComputedWorldValue()).

The coordinate systems in vtk are as follows:

  DISPLAY - x-y pixel values in window 0, 0 is the lower left of the first pixel, size, size is the upper right of the last pixel

  NORMALIZED DISPLAY -  x-y (0,1) normalized values 0, 0 is the lower left of the first pixel, 1, 1 is the upper right of the last pixel

  VIEWPORT - x-y pixel values in viewport 0, 0 is the lower left of the first pixel, size, size is the upper right of the last pixel

  NORMALIZED VIEWPORT - x-y (0,1) normalized value in viewport 0, 0 is the lower left of the first pixel, 1, 1 is the upper right of the last pixel

  VIEW - x-y-z (-1,1) values in pose coordinates. (z is depth)

  POSE - world coords translated and rotated to the camera position and view direction

  WORLD - x-y-z global coordinate values

  USERDEFINED - x-y-z in User defined space

If you cascade vtkCoordinate objects, you refer to another vtkCoordinate object which in turn can refer to others, and so on.
This allows you to create composite groups of things like vtkActor2D that are positioned relative to one another. 
Note that in cascaded sequences, each vtkCoordinate object may be specified in different coordinate systems!




## See Also

[vtkActor](./Rendering_Core_Actor.html)2D

## Methods


### extend

Method use to decorate a given object (publicAPI+model) with vtkCoordinate characteristics.


| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **publicAPI** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> | object on which methods will be bounds (public) |
| **model** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> | object on which data structure will be bounds (protected) |
| **initialValues** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> | (default: {}) |


### getComputedDisplayValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedDoubleDisplayValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedDoubleViewportValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedLocalDisplayValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedViewportValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getComputedWorldValue




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **ren** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### getCoordinateSystem

Get the coordinate system which this coordinate is defined in.
The options are Display, Normalized Display, Viewport, Normalized Viewport, View, and World.



### getCoordinateSystemAsString

Get the coordinate system which this coordinate is defined in as string.



### getReferenceCoordinate





### getRenderer

Get mapper that was picked (if any)



### getValue

Get the value of this coordinate.



### newInstance

Method use to create a new instance of vtkCoordinate


| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **initialValues** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> | for pre-setting some of its content |


### setCoordinateSystem

Set the coordinate system which this coordinate is defined in.
The options are Display, Normalized Display, Viewport, Normalized Viewport, View, and World.


| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **coordinateSystem** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### setCoordinateSystemToDisplay

Set the coordinate system to Coordinate.DISPLAY



### setCoordinateSystemToNormalizedDisplay

Set the coordinate system to Coordinate.NORMALIZED_DISPLAY



### setCoordinateSystemToNormalizedViewport

Set the coordinate system to Coordinate.NORMALIZED_VIEWPORT



### setCoordinateSystemToProjection

Set the coordinate system to Coordinate.PROJECTION



### setCoordinateSystemToView

Set the coordinate system to Coordinate.VIEW



### setCoordinateSystemToViewport

Set the coordinate system to Coordinate.VIEWPORT



### setCoordinateSystemToWorld

Set the coordinate system to Coordinate.WORLD



### setProperty




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **property** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### setReferenceCoordinate




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **referenceCoordinate** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### setRenderer




| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **renderer** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


### setValue

Set the value of this coordinate.


| Argument | Type | Description |
| ------------- | ------------- | ----- |
| **...args** | <span class="arg-type"></span></br></span><span class="arg-required">required</span> |  |


