/**
# T5.Geo.JSON
_module_


This module provides GeoJSON support for Tile5.
*/
T5.Geo.JSON = (function() {
    
    // define some constants
    var FEATURE_TYPE_COLLECTION = 'featurecollection',
        FEATURE_TYPE_FEATURE = 'feature',
        VECTORIZE_OPTIONS = {
            async: false
        },
        
        DEFAULT_FEATUREDEF = {
            processor: null,
            group: 'shapes',
            layerClass: T5.ShapeLayer
        };

    // initialise feature definitions
    var featureDefinitions = {
        
        point: T5.ex({}, DEFAULT_FEATUREDEF, {
            processor: processPoint,
            group: 'markers',
            layerClass: T5.MarkerLayer
        }),
        
        linestring: T5.ex({}, DEFAULT_FEATUREDEF, {
            processor: processLineString
        }),
        multilinestring: T5.ex({}, DEFAULT_FEATUREDEF, {
            processor: processMultiLineString
        }),
        
        polygon: T5.ex({}, DEFAULT_FEATUREDEF, {
            processor: processPolygon
        }),
        multipolygon: T5.ex({}, DEFAULT_FEATUREDEF, {
            processor: processMultiPolygon
        })
    };
    
    /* feature processor utilities */
    
    function createLine(layer, coordinates, options) {
        var vectors = readVectors(coordinates);
        
        layer.add(new T5.Poly(vectors, options));
        return vectors.length;
    } // createLine
    
    function createMarker(layer, xy, options) {
        var marker;
        
        // if a marker builder is defined, then build using that
        if (options.markerBuilder) {
            marker = options.markerBuilder(xy);
        }
        // otherwise, just build a standard marker
        else {
            marker = new T5.Marker({
                xy: xy
            });
        } // if..else
        
        // add the marker
        layer.add(marker);
    } // createMarker
    
    function createPoly(layer, coordinates, options) {
        // TODO: check this is ok...
        var vectors = readVectors(coordinates);
        layer.add(new T5.Poly(vectors, T5.ex({
            fill: true
        }, options)));
        
        return vectors.length;
    } // createPoly
    
    function readVectors(coordinates) {
        var count = coordinates ? coordinates.length : 0,
            positions = new Array(count);
            
        for (var ii = count; ii--; ) {
            positions[ii] = new T5.Geo.Position(coordinates[ii][1], coordinates[ii][0]);
        } // for

        return T5.Geo.P.vectorize(positions, VECTORIZE_OPTIONS);
    } // getLineStringVectors
    
    /* feature processor functions */
    
    function processLineString(layer, featureData, options) {
        // TODO: check this is ok...
        var vectors = readVectors(featureData && featureData.coordinates ? featureData.coordinates : []);
        
        return createLine(layer, vectors, options);
    } // processLineString
    
    function processMultiLineString(layer, featureData, options) {
        var coordinates = featureData && featureData.coordinates ? featureData.coordinates : [],
            pointsProcessed = 0;
        
        for (var ii = coordinates.length; ii--; ) {
            pointsProcessed += createLine(layer, coordinates[ii], options);
        } // for
        
        return pointsProcessed;
    } // processMultiLineString
    
    function processPoint(layer, featureData, options) {
        var points = readVectors([featureData.coordinates], VECTORIZE_OPTIONS);

        if (points.length > 0) {
            createMarker(layer, points[0], options);
        } // if
    } // processPoint
    
    function processPolygon(layer, featureData, options) {
        var coordinates = featureData && featureData.coordinates ? featureData.coordinates : [];
        if (coordinates.length > 0) {
            return createPoly(layer, coordinates[0], options);
        } // if
        
        return 0;
    } // processPolygon
    
    function processMultiPolygon(layer, featureData, options) {
        var coordinates = featureData && featureData.coordinates ? featureData.coordinates : [],
            pointsProcessed = 0;
        
        for (var ii = 0; ii < coordinates.length; ii++) {
            pointsProcessed += createPoly(layer, coordinates[ii][0], options);
        } // for
        
        return pointsProcessed;
    } // processMultiPolygon
    
    /* define the GeoJSON parser */
    
    var GeoJSONParser = function(data, callback, options) {
        options = T5.ex({
            vectorsPerCycle: T5.Geo.VECTORIZE_PER_CYCLE,
            rowPreParse: null,
            simplify: false,
            layerPrefix: 'geojson-',
            markerBuilder: null
        }, options);
        
        // initialise variables
        var vectorsPerCycle = options.vectorsPerCycle,
            rowPreParse = options.rowPreParse,
            layerPrefix = options.layerPrefix,
            featureIndex = 0,
            totalFeatures = 0,
            childParser = null,
            childCount = 0,
            layers = {},
            worker;

        // if we have no data, then exit
        if (! data) {
            return null;
        } // if
        
        // check that the data is in an array, if not, then make one
        if (typeof data.length === 'undefined') {
            data = [data];
        } // if
            
        /* parser functions */
        
        function addFeature(definition, featureInfo) {
            var processor = definition.processor, 
                layerId = layerPrefix + definition.group,
                featureOpts = T5.ex({}, definition, options, {
                    properties: featureInfo.properties
                });
                
            if (processor) {
                return processor(getLayer(layerId, definition.layerClass), featureInfo.data, featureOpts);
            } // if
            
            return 0;
        } // addFeature
        
        function extractFeatureInfo(featureData, properties) {
            var featureType = featureData && featureData.type ? featureData.type.toLowerCase() : null;
            
            if (featureType && featureType === FEATURE_TYPE_FEATURE) {
                return extractFeatureInfo(featureData.geometry, featureData.properties);
            }
            else {
                return {
                    type: featureType,
                    isCollection: (featureType ? featureType === FEATURE_TYPE_COLLECTION : false),
                    definition: featureDefinitions[featureType],
                    data: featureData,
                    properties: properties ? properties : featureData.properties
                };
            } // if..else
        } // extractFeatureInfo
        
        function featureToPoly(feature, callback) {
        } // featureToPrimitives
        
        function getLayer(layerId, layerClass) {
            var layer = layers[layerId];
            
            if (! layer) {
                layer = new layerClass({
                    id: layerId
                });
                
                layers[layerId] = layer;
            } // if
            
            globalLayers = layers;
            return layer;
        } // getLayer
        
        function handleParseComplete(evt) {
            if (callback) {
                callback(layers);
            } // if
        } // handleParseComplete

        function processData(tickCount, worker) {
            var cycleCount = 0,
                ii = featureIndex;
                
            // if we have a child worker active, then don't do anything in this worker
            if (childParser) {
                return;
            }
            
            // COG.Log.info('processing data, featureIndex = ' + featureIndex + ', total features = ' + totalFeatures);
            for (; ii < totalFeatures; ii++) {
                // get the feature data
                // if a row preparser is defined, then use that
                var featureInfo = extractFeatureInfo(rowPreParse ? rowPreParse(data[ii]) : data[ii]),
                    processedCount = null;
                    
                // if we have a collection, then create the child worker to process the features
                if (featureInfo.isCollection) {
                    childCount += 1;
                    
                    // create the worker
                    childParser = parse(
                        featureInfo.data.features, 
                        function(childLayers) {
                            childParser = null;
                            
                            // copy the child layers back
                            for (var layerId in childLayers) {
                                layers[layerId] = childLayers[layerId];
                            } // for
                        }, {
                            layerPrefix: layerPrefix + childCount + '-'
                        });
                        
                    processedCount += 1;
                }
                // if the processor is defined, then run it
                else if (featureInfo.definition) {
                    processedCount = addFeature(featureInfo.definition, featureInfo);
                } // if..else
                
                // increment the cycle count
                cycleCount += processedCount ? processedCount : 1;
                
                // increase the cycle counter and check that we haven't processed too many
                if (cycleCount >= vectorsPerCycle) {
                    break;
                } // if
            } // for
            
            // increment the feature index to the next feature after this loop
            featureIndex = ii + 1;
            
            // if we have finished, then tell the worker we are done
            if ((! childParser) && (featureIndex >= totalFeatures)) {
                // TODO: add a sort step to sort the shapes from largest (at the back) to smallest at the front
                worker.trigger('complete');
            } // if
        } // processData
        
        /* run the parser */
        
        // save the total feature count
        totalFeatures = data.length;
        
        // create the worker
        worker = COG.Loopage.join({
            frequency: 10,
            execute: processData
        });
        
        // when the worker has completed, fire the callback
        worker.bind('complete', handleParseComplete);
        
        return worker;
    };
    
    /* exported functions */
    
    function parse(data, callback, options) {
        return new GeoJSONParser(data, callback, options);
    } // parse
    
    /* module definition */
    
    var module = {
        parse: parse
    };
    
    return module;
})();

