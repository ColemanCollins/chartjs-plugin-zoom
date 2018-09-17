/*jslint browser:true, devel:true, white:true, vars:true */
/*global require*/

// hammer JS for touch support
var Hammer = require('hammerjs');
Hammer = typeof(Hammer) === 'function' ? Hammer : window.Hammer;

// Get the chart variable
var Chart = require('chart.js');
Chart = typeof(Chart) === 'function' ? Chart : window.Chart;
var helpers = Chart.helpers;

// Take the zoom namespace of Chart
var zoomNS = Chart.Zoom = Chart.Zoom || {};

// Where we store functions to handle different scale types
var zoomFunctions = zoomNS.zoomFunctions = zoomNS.zoomFunctions || {};
var panFunctions = zoomNS.panFunctions = zoomNS.panFunctions || {};

// Default options if none are provided
var defaultOptions = zoomNS.defaults = {
	pan: {
		enabled: true,
		mode: 'xy',
		speed: 20,
		threshold: 10
	},
	zoom: {
		enabled: true,
		mode: 'xy',
		sensitivity: 3,
		zoomStrength: 30
	}
};

function directionEnabled(mode, dir) {
	if (mode === undefined) {
		return true;
	} else if (typeof mode === 'string') {
		return mode.indexOf(dir) !== -1;
	}

	return false;
}

function rangeMaxLimiter(zoomPanOptions, newMax) {
	if (zoomPanOptions.scaleAxes && zoomPanOptions.rangeMax &&
			!helpers.isNullOrUndef(zoomPanOptions.rangeMax[zoomPanOptions.scaleAxes])) {
		var rangeMax = zoomPanOptions.rangeMax[zoomPanOptions.scaleAxes];
		if (newMax > rangeMax) {
			newMax = rangeMax;
		}
	}
	return newMax;
}

function rangeMinLimiter(zoomPanOptions, newMin) {
	if (zoomPanOptions.scaleAxes && zoomPanOptions.rangeMin &&
			!helpers.isNullOrUndef(zoomPanOptions.rangeMin[zoomPanOptions.scaleAxes])) {
		var rangeMin = zoomPanOptions.rangeMin[zoomPanOptions.scaleAxes];
		if (newMin < rangeMin) {
			newMin = rangeMin;
		}
	}
	return newMin;
}

function zoomIndexScale(scale, zoom, center, zoomOptions) {
	var min = scale.minIndex;
	var max = scale.maxIndex;
	var range = max - min;
	var newDiff = range * (zoom - 1);

	var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	var min_percent = (scale.getValueForPixel(cursorPixel) - min) / range;
	var max_percent = 1 - min_percent;

	var minDelta = Math.round(newDiff * min_percent);
	var maxDelta = Math.round(newDiff * max_percent);

	var labels = scale.chart.data.labels;
	scale.options.ticks.min = rangeMinLimiter(zoomOptions, labels[min + minDelta]);
	scale.options.ticks.max = rangeMaxLimiter(zoomOptions, labels[max - maxDelta]);
	return;
}

function zoomTimeScale(scale, zoom, center, zoomOptions) {
	var options = scale.options;

	var range;
	var min_percent;
	if (scale.isHorizontal()) {
		range = scale.right - scale.left;
		min_percent = (center.x - scale.left) / range;
	} else {
		range = scale.bottom - scale.top;
		min_percent = (center.y - scale.top) / range;
	}

	var max_percent = 1 - min_percent;
	var newDiff = range * (zoom - 1);

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	var newMin = scale.getValueForPixel(scale.getPixelForValue(scale.min) + minDelta);
	var newMax = scale.getValueForPixel(scale.getPixelForValue(scale.max) - maxDelta);

	var diffMinMax = newMax.diff(newMin);
	var minLimitExceeded = rangeMinLimiter(zoomOptions, diffMinMax) != diffMinMax;
	var maxLimitExceeded = rangeMaxLimiter(zoomOptions, diffMinMax) != diffMinMax;

	if (!minLimitExceeded && !maxLimitExceeded) {
		options.time.min = newMin;
		options.time.max = newMax;
	}
}

function zoomNumericalScale(scale, zoom, center, zoomOptions) {
	var range = scale.max - scale.min;
	var newDiff = range * (zoom - 1);

	var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	var min_percent = (scale.getValueForPixel(cursorPixel) - scale.min) / range;
	var max_percent = 1 - min_percent;

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	scale.options.ticks.min = rangeMinLimiter(zoomOptions, scale.min + minDelta);
	scale.options.ticks.max = rangeMaxLimiter(zoomOptions, scale.max - maxDelta);
}

function zoomScale(scale, zoom, center, zoomOptions) {
	var fn = zoomFunctions[scale.options.type];
	if (fn) {
		fn(scale, zoom, center, zoomOptions);
	}
}

function doZoom(chartInstance, zoomX, zoomY, center, whichAxes) {
	var ca = chartInstance.chartArea;
	if (!center) {
		center = {
			x: (ca.left + ca.right) / 2,
			y: (ca.top + ca.bottom) / 2,
		};
	}

	var zoomOptions = chartInstance.options.zoom;

	if (zoomOptions && helpers.getValueOrDefault(zoomOptions.enabled, defaultOptions.zoom.enabled)) {
		// Do the zoom here
		var zoomMode = helpers.getValueOrDefault(chartInstance.options.zoom.mode, defaultOptions.zoom.mode);
		zoomOptions.sensitivity = helpers.getValueOrDefault(chartInstance.options.zoom.sensitivity, defaultOptions.zoom.sensitivity);

		// Which axe should be modified when figers were used.
		var _whichAxes;
		if (zoomMode == 'xy' && whichAxes !== undefined) {
			// based on fingers positions
			_whichAxes = whichAxes;
		} else {
			// no effect
			_whichAxes = 'xy';
		}

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(zoomMode, 'x') && directionEnabled(_whichAxes, 'x')) {
				zoomOptions.scaleAxes = "x";
				zoomScale(scale, zoomX, center, zoomOptions);
			} else if (!scale.isHorizontal() && directionEnabled(zoomMode, 'y') && directionEnabled(_whichAxes, 'y')) {
				zoomOptions.scaleAxes = "y";
				zoomScale(scale, zoomY, center, zoomOptions);
			}
		});

		chartInstance.update(0);

		if (typeof zoomOptions.onZoom === 'function') {
			zoomOptions.onZoom();
		}
	}
}

function panIndexScale(scale, delta, panOptions) {
	var labels = scale.chart.data.labels;
	var lastLabelIndex = labels.length - 1;
	var minIndex = scale.minIndex;
	var maxIndex = scale.maxIndex;

	var dIndex = scale.getValueForPixel(Math.abs(delta)) - scale.getValueForPixel(0);
	if (delta > 0) dIndex *= -1;

	if (minIndex + dIndex < 0) dIndex = -minIndex;
	if (maxIndex + dIndex > lastLabelIndex) dIndex = lastLabelIndex - maxIndex;

	minIndex += dIndex;
	maxIndex += dIndex;

	scale.options.ticks.min = rangeMinLimiter(panOptions, labels[minIndex]);
	scale.options.ticks.max = rangeMaxLimiter(panOptions, labels[maxIndex]);
}

function panTimeScale(scale, delta, panOptions) {
	var options = scale.options;
	var limitedMax = rangeMaxLimiter(panOptions, scale.getValueForPixel(scale.getPixelForValue(scale.max) - delta));
	var limitedMin = rangeMinLimiter(panOptions, scale.getValueForPixel(scale.getPixelForValue(scale.min) - delta));

	var limitedTimeDelta = delta < 0 ? limitedMax - scale.max : limitedMin - scale.min;

	options.time.max = scale.max + limitedTimeDelta;
	options.time.min = scale.min + limitedTimeDelta;
}

function panNumericalScale(scale, delta, panOptions) {
	var tickOpts = scale.options.ticks;
	var start = scale.start,
		end = scale.end;

	var rangeMin, rangeMax
	if (panOptions.scaleAxes && panOptions.rangeMin &&
		!helpers.isNullOrUndef(panOptions.rangeMin[panOptions.scaleAxes])) {
		rangeMin = panOptions.rangeMin[panOptions.scaleAxes];
	}
	if (panOptions.scaleAxes && panOptions.rangeMax &&
		!helpers.isNullOrUndef(panOptions.rangeMax[panOptions.scaleAxes])) {
		rangeMax = panOptions.rangeMax[panOptions.scaleAxes];
	}
	var newMin, newMax, diff
	newMin = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
	newMax = scale.getValueForPixel(scale.getPixelForValue(end) - delta);

	// Dont scale if either limit is reached
	// Move to the limit, for the last small step
	if (newMin < rangeMin) {
		diff = start - rangeMin
		tickOpts.min = rangeMin
		tickOpts.max = end - diff
	} else if (newMax > rangeMax) {
		diff = rangeMax - end
		tickOpts.max = rangeMax
		tickOpts.min = start + diff
	} else {
		tickOpts.min = newMin
		tickOpts.max = newMax
	}
}

function panScale(scale, delta, panOptions) {
	var fn = panFunctions[scale.options.type];
	if (fn) {
		fn(scale, delta, panOptions);
	}
}

function doPan(chartInstance, deltaX, deltaY) {
	var panOptions = chartInstance.options.pan;
	if (panOptions && helpers.getValueOrDefault(panOptions.enabled, defaultOptions.pan.enabled)) {
		var panMode = helpers.getValueOrDefault(chartInstance.options.pan.mode, defaultOptions.pan.mode);
		panOptions.speed = helpers.getValueOrDefault(chartInstance.options.pan.speed, defaultOptions.pan.speed);

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(panMode, 'x') && deltaX !== 0) {
				panOptions.scaleAxes = "x";
				panScale(scale, deltaX, panOptions);
			} else if (!scale.isHorizontal() && directionEnabled(panMode, 'y') && deltaY !== 0) {
				panOptions.scaleAxes = "y";
				panScale(scale, deltaY, panOptions);
			}
		});

		chartInstance.update(0);

		if (typeof panOptions.onPan === 'function') {
			panOptions.onPan();
		}
	}
}

function positionInChartArea(chartInstance, position) {
	return 	(position.x >= chartInstance.chartArea.left && position.x <= chartInstance.chartArea.right) &&
		(position.y >= chartInstance.chartArea.top && position.y <= chartInstance.chartArea.bottom);
}

/**********************************************************************
*  @brief  Returns a chart's X-axis.
*  @param  chartInstance   An instance of `Chart`.
*  @param  id  An optional axis id. If specified, the function will look
*  for the axis with that id. Otherwise, the first horizontal axis will be
*  returned.
*  @param  axis	An object of a `*Scale` class.
**********************************************************************/
function getXAxis( chartInstance, id ) {
	var scales = chartInstance.scales;
	if ( id !== undefined ) {
		return scales[id];
	}
	for (var scaleId in scales) {
		var scale = scales[scaleId];
		if ( scale.isHorizontal() ) {
			return scale;
		}
	}
}

/**********************************************************************
*  @brief  Returns a chart's Y-axis.
*  @param  chartInstance   An instance of `Chart`.
*  @param  id  An optional axis id. If specified, the function will look
*  for the axis with that id. Otherwise, the first vertical axis will be
*  returned.
*  @param  axis	An object of a `*Scale` class.
**********************************************************************/
function getYAxis( chartInstance, id ) {
	var scales = chartInstance.scales;
	if ( id !== undefined ) {
		return scales[id];
	}
	for ( var scaleId in scales ) {
		var scale = scales[scaleId];
		if ( ! scale.isHorizontal() ) {
			return scale;
		}
	}
}

// Store these for later
zoomNS.zoomFunctions.category = zoomIndexScale;
zoomNS.zoomFunctions.time = zoomTimeScale;
zoomNS.zoomFunctions.linear = zoomNumericalScale;
zoomNS.zoomFunctions.logarithmic = zoomNumericalScale;
zoomNS.panFunctions.category = panIndexScale;
zoomNS.panFunctions.time = panTimeScale;
zoomNS.panFunctions.linear = panNumericalScale;
zoomNS.panFunctions.logarithmic = panNumericalScale;
// Globals for catergory pan and zoom
zoomNS.panCumulativeDelta = 0;
zoomNS.zoomCumulativeDelta = 0;

// Chartjs Zoom Plugin
var zoomPlugin = {
	afterInit: function(chartInstance) {
		helpers.each(chartInstance.scales, function(scale) {
			scale.originalOptions = helpers.clone(scale.options);
		});

		chartInstance.resetZoom = function(newZoom) {
			newZoom = newZoom || {};
			helpers.each(chartInstance.scales, function(scale, id) {
				var timeOptions = scale.options.time   || {};
				var tickOptions = scale.options.ticks  || {};
				var origTimeOptions = scale.originalOptions.time;
				var origTickOptions = scale.originalOptions.ticks;

				if (timeOptions) {
					timeOptions.min = origTimeOptions.min;
					timeOptions.max = origTimeOptions.max;
				}

				if (tickOptions) {
					tickOptions.min = origTickOptions.min;
					tickOptions.max = origTickOptions.max;
				}

				if (newZoom[id]) {
					var newTimeOptions  = newZoom[id].time 	 || {};
					timeOptions.min = newTimeOptions.min === undefined 
														? (timeOptions ? origTimeOptions.min : undefined) 
														: newTimeOptions.min;
					timeOptions.max = newTimeOptions.max === undefined 
														? (timeOptions ? origTimeOptions.max : undefined) 
														: newTimeOptions.max;

					var newTickOptions  = newZoom[id].ticks  || {};
					tickOptions.min = newTickOptions.min === undefined ? (tickOptions ? origTimeOptions.min : undefined) : newTickOptions.min;
					tickOptions.max = newTickOptions.max === undefined ? (tickOptions ? origTimeOptions.max : undefined) : newTickOptions.max;
				}

			});

			helpers.each(chartInstance.data.datasets, function(dataset, id) {
				dataset._meta = null;
			});

			chartInstance.update();
		};

		/***************************************************************
		*  @brief  Zooms the chart to given limits along specified axes.
		*  @param  limits  An object of the form:
		*  ~~~~
		*  {
		*	  x: { min: 0, max: 10.1, axis_id: 'x-axis-1' },
		*	  y: { min: 1.34, max: 22.8, axis_id: 'y-axis-1' },
		*  }
		*  ~~~~
		***************************************************************/
		chartInstance.zoomToLimits = function ( limits ) {

			var zoomOptions = chartInstance.options.zoom;
			var limits_x = limits.x,  limits_y = limits.y;
			var axis, min, max;

			if ( limits_x !== undefined )
			{
				axis = getXAxis( chartInstance, limits_x.axis_id );
				min = limits_x.min === undefined  ? axis.min  : limits_x.min;
				max = limits_x.max === undefined  ? axis.max  : limits_x.max;
				axis.options.ticks.min = rangeMinLimiter( zoomOptions, min );
				axis.options.ticks.max = rangeMaxLimiter( zoomOptions, max );
			}

			if ( limits_y !== undefined )
			{
				axis = getYAxis( chartInstance, limits_y.axis_id );
				min = limits_y.min === undefined  ? axis.min  : limits_y.min;
				max = limits_y.max === undefined  ? axis.max  : limits_y.max;
				axis.options.ticks.min = rangeMinLimiter( zoomOptions, min );
				axis.options.ticks.max = rangeMaxLimiter( zoomOptions, max );
			}

			chartInstance.update( 0 );

		};

	},
	beforeInit: function(chartInstance) {
		chartInstance.zoom = {};

		var node = chartInstance.zoom.node = chartInstance.chart.ctx.canvas;

		var options = chartInstance.options;

		var panThreshold = helpers.getValueOrDefault(options.pan ? options.pan.threshold : undefined, zoomNS.defaults.pan.threshold);
		if (!options.zoom || !options.zoom.enabled) {
			return;
		}
		if (options.zoom && options.zoom.drag) {

			chartInstance.zoom._mouseDownHandler = function(event) {
				//if pan is enabled, do drag zoom on RMB click
				//do a live check to make sure panning hasn't been turned off since we attached the handler
				if ((chartInstance.options.pan||{}).enabled && event.button === 2) {
					chartInstance.zoom._dragZoomStart = event;
				}
			};
			node.addEventListener('mousedown', chartInstance.zoom._mouseDownHandler);
			//if we want drag zooming and panning at the, kill the default context
			//menu on the chart so we can bind RMB without issues.
			if (options.pan && options.pan.enabled) {
				node.addEventListener('contextmenu', function(event) {
					//make sure panning is still enabled
					if ((chartInstance.options.pan||{}).enabled) {
						event.preventDefault();
					}
				});
			}

			chartInstance.zoom._mouseMoveHandler = function(event){
				if (chartInstance.zoom._dragZoomStart) {
					chartInstance.zoom._dragZoomEnd = event;
					chartInstance.update(0);
				}
			};
			node.addEventListener('mousemove', chartInstance.zoom._mouseMoveHandler);

			chartInstance.zoom._mouseUpHandler = function(event){
				if (chartInstance.zoom._dragZoomStart) {
					var chartArea = chartInstance.chartArea;
					var xAxis = getXAxis(chartInstance);
					var yAxis = getYAxis(chartInstance);
					var beginPoint = chartInstance.zoom._dragZoomStart;

					var startX = xAxis.left;
					var endX = xAxis.right;
					var startY = yAxis.top;
					var endY = yAxis.bottom;

					if (directionEnabled(options.zoom.mode, 'x')) {
						var offsetX = beginPoint.target.getBoundingClientRect().left;
						startX = Math.min(beginPoint.clientX, event.clientX) - offsetX;
						endX = Math.max(beginPoint.clientX, event.clientX) - offsetX;
					}

					if (directionEnabled(options.zoom.mode, 'y')) {
						var offsetY = beginPoint.target.getBoundingClientRect().top;
						startY = Math.min(beginPoint.clientY, event.clientY) - offsetY;
						endY = Math.max(beginPoint.clientY, event.clientY) - offsetY;
					}

					var dragDistanceX = endX - startX;
					var chartDistanceX = chartArea.right - chartArea.left;
					var zoomX = 1 + ((chartDistanceX - dragDistanceX) / chartDistanceX );

					var dragDistanceY = endY - startY;
					var chartDistanceY = chartArea.bottom - chartArea.top;
					var zoomY = 1 + ((chartDistanceY - dragDistanceY) / chartDistanceY );

					chartInstance.zoom._dragZoomStart = null;
					chartInstance.zoom._dragZoomEnd = null;

					if (dragDistanceX > 0 || dragDistanceY > 0) {
						doZoom(chartInstance, zoomX, zoomY, {
							x: dragDistanceX / 2 + startX,
							y: dragDistanceY / 2 + startY,
						});
					}
				}
			};
			node.addEventListener('mouseup', chartInstance.zoom._mouseUpHandler);
		}

		chartInstance.zoom._wheelHandler = function(event) {
				var zoomOptions = chartInstance.options.zoom;
				// Prevent the event from triggering the default behavior (eg. Content scrolling).
				if (zoomOptions.enabled) {
					event.preventDefault();
				} else {
				// if no zooming, no need to continue.
					return;
				}

				var rect = event.target.getBoundingClientRect();
				var offsetX = event.clientX - rect.left;
				var offsetY = event.clientY - rect.top;
				var center = {
					x : offsetX,
					y : offsetY
				};

				var zoomInDirection = function zoomInDirection(direction) {
					var zoomStrength = helpers.getValueOrDefault(zoomOptions.zoomStrength, defaultOptions.zoom.zoomStrength)/1000;
					var zoomIn = 1 + zoomStrength;
					var zoomOut = 1 - zoomStrength;
					if (event.deltaY < 0) { doZoom(chartInstance, zoomIn, zoomIn, center, direction) }
					else { doZoom(chartInstance, zoomOut, zoomOut, center, direction) };
				}

				if (zoomOptions.axisHoverZoom) {
					var isHoveringOnHorizontalAxis = false;
					var isHoveringOnVerticalAxis = false;

					var scales = chartInstance.scales;
					//for all of the registered scales
					for (var scaleID in scales) {
						var scale = scales[scaleID];
						var axisTop = scale.top;
						var axisBottom = scale.bottom;
						var axisRight = scale.right;
						var axisLeft = scale.left;

						//check if our hover point is within the axis' zone
						if (offsetY >= axisTop && offsetY <= axisBottom && 
								offsetX >= axisLeft && offsetX <= axisRight ) {
								isHoveringOnHorizontalAxis = scale.isHorizontal() ? true : false;
								isHoveringOnVerticalAxis = scale.isHorizontal() ? false : true;
						}
					}

					if (isHoveringOnHorizontalAxis) {
						zoomInDirection('x');
					} else if (isHoveringOnVerticalAxis) {
						zoomInDirection('y');
					} else {
						zoomInDirection('xy');
					}

				} else {
					zoomInDirection('xy');
				}
		};

		node.addEventListener('wheel', chartInstance.zoom._wheelHandler);

		if (Hammer) {
			var mc = new Hammer.Manager(node);
			mc.add(new Hammer.Pinch());
			mc.add(new Hammer.Pan({
				threshold: panThreshold
			}));

			// Hammer reports the total scaling. We need the incremental amount
			var currentPinchScaling;
			var handlePinch = function handlePinch(e) {
				var diff = 1 / (currentPinchScaling) * e.scale;
				var rect = e.target.getBoundingClientRect();
				var offsetX = e.center.x - rect.left;
				var offsetY = e.center.y - rect.top;
				var center = {
					x : offsetX,
					y : offsetY
				};

				// fingers position difference
				var x = Math.abs(e.pointers[0].clientX - e.pointers[1].clientX);
				var y = Math.abs(e.pointers[0].clientY - e.pointers[1].clientY);

				// diagonal fingers will change both (xy) axes
				var p = x / y;
				var xy;
				if (p > 0.3 && p < 1.7) {
					xy = 'xy';
				}
				// x axis
				else if (x > y) {
					xy = 'x';
				}
				// y axis
				else {
					xy = 'y';
				}

				doZoom(chartInstance, diff, center, xy);

				// Keep track of overall scale
				currentPinchScaling = e.scale;
			};

			mc.on('pinchstart', function(e) {
				currentPinchScaling = 1; // reset tracker
			});
			mc.on('pinch', handlePinch);
			mc.on('pinchend', function(e) {
				handlePinch(e);
				currentPinchScaling = null; // reset
				zoomNS.zoomCumulativeDelta = 0;
			});

			var currentDeltaX = null, currentDeltaY = null, panning = false;
			var handlePan = function handlePan(e) {
				if (currentDeltaX !== null && currentDeltaY !== null) {
					panning = true;
					var deltaX = e.deltaX - currentDeltaX;
					var deltaY = e.deltaY - currentDeltaY;
					currentDeltaX = e.deltaX;
					currentDeltaY = e.deltaY;
					doPan(chartInstance, deltaX, deltaY);
				}
			};

			mc.on('panstart', function(e) {
				currentDeltaX = 0;
				currentDeltaY = 0;
				handlePan(e);
			});
			mc.on('panmove', handlePan);
			mc.on('panend', function(e) {
				currentDeltaX = null;
				currentDeltaY = null;
				zoomNS.panCumulativeDelta = 0;
				setTimeout(function() { panning = false; }, 500);
			});

			chartInstance.zoom._ghostClickHandler = function(e) {
				if (panning) {
					e.stopImmediatePropagation();
					e.preventDefault();
				}
			};
			node.addEventListener('click', chartInstance.zoom._ghostClickHandler);

			chartInstance._mc = mc;
		}
	},

	beforeDatasetsDraw: function(chartInstance) {
		if (!chartInstance.options.zoom || !chartInstance.options.zoom.enabled) {
			return;
		}

		var ctx = chartInstance.chart.ctx;
		var chartArea = chartInstance.chartArea;
		ctx.save();
		ctx.beginPath();

		if (chartInstance.zoom._dragZoomEnd) {
			var xAxis = getXAxis(chartInstance);
			var yAxis = getYAxis(chartInstance);
			var beginPoint = chartInstance.zoom._dragZoomStart;
			var endPoint = chartInstance.zoom._dragZoomEnd;

			var startX = xAxis.left;
			var endX = xAxis.right;
			var startY = yAxis.top;
			var endY = yAxis.bottom;

			if (directionEnabled(chartInstance.options.zoom.mode, 'x')) {
				var offsetX = beginPoint.target.getBoundingClientRect().left;
				startX = Math.min(beginPoint.clientX, endPoint.clientX) - offsetX;
				endX = Math.max(beginPoint.clientX, endPoint.clientX) - offsetX;
			}

			if (directionEnabled(chartInstance.options.zoom.mode, 'y')) {
				var offsetY = beginPoint.target.getBoundingClientRect().top;
				startY = Math.min(beginPoint.clientY, endPoint.clientY) - offsetY;
				endY = Math.max(beginPoint.clientY, endPoint.clientY) - offsetY;
			}

			var rectWidth = endX - startX;
			var rectHeight = endY - startY;

			var dragOptions = chartInstance.options.zoom.drag;
 
 			ctx.fillStyle = dragOptions.backgroundColor || 'rgba(225,225,225,0.3)';
			ctx.fillRect(startX, startY, rectWidth, rectHeight);

			if (dragOptions.borderWidth > 0) {
				ctx.lineWidth = dragOptions.borderWidth;
				ctx.strokeStyle = dragOptions.borderColor || 'rgba(225,225,225)';
				ctx.strokeRect(startX, yAxis.top, rectWidth, yAxis.bottom - yAxis.top);
			}
 		}
 		ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
		ctx.clip();
	},

	afterDatasetsDraw: function(chartInstance) {
		if (!chartInstance.options.zoom || !chartInstance.options.zoom.enabled) {
			return;
		}
		chartInstance.chart.ctx.restore();
	},

	destroy: function(chartInstance) {
		if (chartInstance.zoom) {
			var options = chartInstance.options;
			var node = chartInstance.zoom.node;

			if (options.zoom && options.zoom.drag) {
				node.removeEventListener('mousedown', chartInstance.zoom._mouseDownHandler);
				node.removeEventListener('mousemove', chartInstance.zoom._mouseMoveHandler);
				node.removeEventListener('mouseup', chartInstance.zoom._mouseUpHandler);
			} else {
				node.removeEventListener('wheel', chartInstance.zoom._wheelHandler);
			}

			if (Hammer) {
				node.removeEventListener('click', chartInstance.zoom._ghostClickHandler);
			}

			delete chartInstance.zoom;

			var mc = chartInstance._mc;
			if (mc) {
				mc.remove('pinchstart');
				mc.remove('pinch');
				mc.remove('pinchend');
				mc.remove('panstart');
				mc.remove('pan');
				mc.remove('panend');
			}
		}
	}
};

module.exports = zoomPlugin;
Chart.pluginService.register(zoomPlugin);
