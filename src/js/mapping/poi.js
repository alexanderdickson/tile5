SLICK.Geo.PointOfInterest = function(args) {
    // initialise default parameters
    var DEFAULT_ARGS = {
        id: 0,
        title: "",
        pos: null,
        lat: "",
        lon: "",
        type: "",
        retrieved: 0
    };

    // extend args with defaults
    args = GRUNT.extend({}, DEFAULT_ARGS, args);
    
    // if the position is not defined, but we have a lat and lon, create a new position
    if ((! args.pos) && args.lat && args.lon) {
        args.pos = new SLICK.Geo.Position(args.lat, args.lon);
    } // if
    
    // initialise self
    var self = {
        id: args.id,
        title: args.title,
        pos: args.pos,
        pin: null,
        type: args.type,
        
        toString: function() {
            return String.format("{0}: '{1}'", self.id, self.title);
        }
    };
    
    return self;
}; // PointOfInterest

SLICK.Geo.POIMarkers = (function() {
    // initialise the marker image cache
    var drawQueue = [];
    var loadedImages = [];
    
    function drawQueuedMarkers(markerType, image, callback) {
        if (drawQueue[markerType]) {
            for (var ii = 0; ii < drawQueue[markerType].length; ii++) {
                var queueItem = drawQueue[markerType][ii];
                queueItem.context.drawImage(image, queueItem.x, queueItem.y);
            } // for
            
            // clear the queue
            drawQueue[markerType] = [];
            
            // if a callback was assigned, then call it to let the caller know the image has been drawn
            if (callback) {
                callback();
            } // if
        } // if
    }
    
    function getMarkerImage(markerType) {
        var fnresult = loadedImages[markerType];
        
        // if the marker image has not yet been loaded, then create a new image and load it
        if (! fnresult) {
            fnresult = new Image();
            fnresult.src = SLICK.Resources.getPath("images/app/markers/" + markerType + ".png");
            
            // add the image to the loaded images array
            loadedImages[markerType] = fnresult;
        } // if
        
        return fnresult;
    } // getMarkerImage
    
    var self = {
        drawMarker: function(context, markerType, x, y, callback) {
            // get the image from the marker cache, if we don't have it then load it
            var markerImage = getMarkerImage(markerType);
            
            // if the marker image has been loaded, then draw it
            if (markerImage.complete) {
                context.drawImage(markerImage, x, y);
            }
            else { 
                if (! markerImage.onload) {
                    markerImage.onload = function() {
                        drawQueuedMarkers(markerType, markerImage, callback);
                    }; // onload
                } // if
                
                
                if (! drawQueue[markerType]) {
                    drawQueue[markerType] = [];
                } // if
                
                // queue the marker image for drawing
                drawQueue[markerType].push({
                    context: context, 
                    x: x,
                    y: y
                });
            }
        }
    };
    
    return self;
})();

SLICK.Geo.POIPin = function(args) {
    // initialise the default args
    var DEFAULT_ARGS = {
        poi: null,
        mercXY: null
    }; // DEFAULT_ARGS
    
    // initialise args
    args = GRUNT.extend({}, DEFAULT_ARGS, args);
    
    // initialise self
    var self = {
        poi: args.poi,
        mercXY: args.mercXY,
        
        drawToContext: function(context, x, y, callback) {
            SLICK.Geo.POIMarkers.drawMarker(context, self.poi.type, x, y, callback);
        }
    }; // self
    
    return self;
}; // POIPin

SLICK.Geo.POIInfoBox = function(args) {
    // initialise default args
    var DEFAULT_ARGS = {
        pois: []
    }; // initialise

    // extend args with the defaults
    args = GRUNT.extend({}, DEFAULT_ARGS, args);
    
    // initialise the pois
    var active_poi = null;
    var pois = args.pois;
    var poi_index = 0;
    
    function updateButtons() {
        var buttons = [];
        
        if (pois.length > 1) {
            // push some test buttons
            buttons.push({
                text: "Back",
                click: function() {
                    self.setActivePOI(poi_index - 1);
                }
            });

            buttons.push({
                text: "Next",
                click: function() {
                    self.setActivePOI(poi_index + 1);
                },
                align: 'right'
            });
        } // if
        
        buttons.push({
            text: "View Details",
            click: function() {
                // save a reference to the button
                var this_button = this;
                
                if (self.getDetailsVisible()) {
                    self.hideDetails();
                }
                else if (self.args.requirePOIDetails) {
                    self.args.requirePOIDetails(self.getActivePOI(), function(details_html) {
                        self.showDetails(details_html);
                    });
                } // if..else
            },
            align: 'center'
        });

        // update the buttons
        self.setButtons(buttons);
    } // updateButtons
    
    function updateDisplay() {
        GRUNT.Log.info("updating poi display: index = " + poi_index);
        
        active_poi = null;
        if ((poi_index >= 0) && (poi_index < pois.length)) {
            active_poi = pois[poi_index];
            self.updateContent("<h4>" + active_poi.title + "</h4>");

            // if the details are visible, then hide them
            if (self.getDetailsVisible()) {
                if (self.args.requirePOIDetails) {
                    self.args.requirePOIDetails(active_poi, function(details_html) {
                        self.showDetails(details_html);
                    });
                }
                else {
                    self.hideDetails();
                } // if..else
            } // if
        } // if
    } // updateDisplay
    
    // create the parent
    var parent = new SLICK.InfoBox(args);
    
    // initialise self
    var self = GRUNT.extend({}, parent, {
        args: args,
        
        getActivePOI: function() {
            return active_poi;
        },
        
        setActivePOI: function(index, force_change) {
            // wrap the index 
            if (index < 0) {
                index = pois.length - 1;
            }
            else if (index >= pois.length) {
                index = 0;
            } // if..else
            
            // if the index is different, then update
            if ((index != poi_index) || force_change) {
                poi_index = index;
                updateDisplay();
                
                // if we have a poi changed event then fire that
                if (args.handlePOIChange) {
                    args.handlePOIChange(pois[poi_index]);
                } // if
            } // if
        },
        
        setPOIs: function(poi_array) {
            pois = [];
            for (var ii = 0; poi_array && (ii < poi_array.length); ii++) {
                pois.push(poi_array[ii]);
            } // for
            
            // if we have pois, then display the info box, if not then hide it
            if (pois.length > 0) {
                updateButtons();
                self.show();
                
                // update the display by forcing a poi update
                self.setActivePOI(0, true);
            }
            else {
                self.hide();
            } // if..else
        } // setPOIs
    });
    
    return self;
}; // POIInfoBox

/*
This class is used to store a list of points of interest and offer some 
simple operations on that array that make managing the pois simpler.

TODO: optimize the find functions
TODO: add a sort function to sort the pois 
*/
SLICK.Geo.POILayer = function(args) {
    // initialise default args
    var DEFAULT_ARGS = {
        visibilityChange: null
    }; 
    
    // initialise variables
    var storage = [];
    var visible = true;
    
    // initialise self
    var self = {
        args: GRUNT.extend({}, DEFAULT_ARGS, args),
        
        getPOIs: function() {
            var fnresult = [];
            for (var ii = 0; ii < storage.length; ii++) {
                fnresult.push(storage[ii]);
            } // for
            
            return fnresult;
        },
        
        getOldPOIs: function(test_time) {
            var fnresult = [];
            for (var ii = 0; ii < storage.length; ii++) {
                if (storage[ii].retrieved < test_time) {
                    fnresult.push(storage[ii]);
                } // if
            } // for
            
            return fnresult;
        },
        
        getVisible: function() {
            return visible;
        },
        
        setVisible: function(value) {
            if (value != visible) {
                visible = value;
                
                // fire the visibility change event
                if (args.visibilityChange) {
                    args.visibilityChange();
                } // if
            } // if
        },
        
        findById: function(search_id) {
            for (var ii = 0; ii < storage.length; ii++) {
                if (storage[ii].id == search_id) {
                    return storage[ii];
                } // if
            } // for
            
            // no result, found return null
            return null;
        },
        
        /*
        Method:  findByBounds
        Returns an array of the points of interest that have been located within
        the bounds of the specified bounding box
        */
        findByBounds: function(search_bounds) {
            var fnresult = [];
            
            // iterate through the pois and check whether they are in the bounds
            for (var ii = 0; ii < storage.length; ii++) {
                if (storage[ii].pos && storage[ii].pos.inBounds(search_bounds)) {
                    fnresult.push(storage[ii]);
                } // if
            } // for
            
            return fnresult;
        },
        
        removeById: function(search_id) {
            // iterate through the array and look for the matching item, when found splice it out of the array
            for (var ii = 0; ii < storage.length; ii++) {
                if (storage[ii].id == search_id) {
                    // TODO: investigate how intesive splice is and whether it would be better batched and use delete
                    storage.splice(ii, 1);
                    return;
                } // if
            } // for
        },
        
        addPOIs: function(new_pois, clear_existing) {
            // if we need to clear existing, then reset the storage
            if (clear_existing) {
                storage = [];
            } // if
            
            // iterate through the new pois and put into storage
            for (var ii = 0; new_pois && (ii < new_pois.length); ii++) {
                new_pois[ii].retrieved = new Date().getTime();
                storage.push(new_pois[ii]);
            } // for
        }
    };
    
    return self;
}; // SLICK.Geo.POILayer

/*
The POIProvider class is used to define generic methods for implementing
something that is going to provide point of interest information on a map.
The provider does not handle displaying any information about the POI, nor
does it enabling pinning on the map.  It simply is responsible for optimized
data retrieval for points of interest.  To that end, the POI provider has 
events that inform the application / tiler when points of interest are added
or removed and hence should be added to or removed from the map.  
*/
SLICK.Geo.POIProvider = function(args) {
    // initialise default args
    var DEFAULT_ARGS = {
        poitype: "",
        onInitRequest: null,
        onCheckBounds: null,
        onParseResponse: null,
        onPOIAdded: null,
        onPOIDeleted: null,
        onChangedPOIs: null,
        layerClass: SLICK.Geo.POILayer
    }; 
    
    // initialise variables
    var last_bounds = new SLICK.Geo.BoundingBox();
    var next_bounds = new SLICK.Geo.BoundingBox();
    var request_active = false;
    var request_timer = 0;
    var update_listeners = [];
    
    /*
    Function:  updatePOIs
    This function is used to compare the old poi array and new poi arrays 
    retrieved from the provider.  Determine which of the pois have been added, 
    which ones removed.  TODO: support poi title changes, etc.
    */
    function updatePOIs(refreshed_pois) {
        // initialise arrays to receive the pois
        var new_pois = [];
        var ii = 0;
        var time_retrieved = new Date().getTime();
        
        GRUNT.Log.info(String.format("{0} pois to process :)", refreshed_pois.length));
        
        // iterate through the pois and determine state
        for (ii = 0; ii < refreshed_pois.length; ii++) {
            // look for the poi in the poi layer
            var found_poi = self.pois.findById(refreshed_pois[ii].id);
        
            // add the poi to either the update or new array according to whether it was found
            if (found_poi) {
                found_poi.retrieved = time_retrieved;
            }
            else {
                new_pois.push(refreshed_pois[ii]);
            }
        } // for
    
        // now all we have left are deleted pois transpose those into the deleted list
        var deleted_pois = self.pois.getOldPOIs(time_retrieved);
        
        // add new pois to the poi layer
        self.pois.addPOIs(new_pois);
        GRUNT.Log.info(String.format("POI-UPDATE: {0} new, {1} deleted", new_pois.length, deleted_pois.length));
            
        // fire the on poi added event when appropriate
        for (ii = 0; self.args.onPOIAdded && (ii < new_pois.length); ii++) {
            self.args.onPOIAdded(new_pois[ii]);
        } // for
    
        for (ii = 0; self.args.onPOIDeleted && (ii < deleted_pois.length); ii++) {
            self.args.onPOIDeleted(deleted_pois[ii]);
            self.pois.removeById(deleted_pois[ii].id);
        } // for
        
        // iterate through the update listeners and let them know things have changed
        for (ii = 0; ii < update_listeners.length; ii++) {
            update_listeners[ii](self);
        } // for
    } // updatePOIs
    
    // extend the args
    args = GRUNT.extend({}, DEFAULT_ARGS, args);
    
    // initialise self
    var self = {
        args: args,
        pois: new args.layerClass(),
        
        getForBounds: function(bounds, callback) {
            // if we are currently, executing a request, then save the bounds as the next query
            if (request_active) {
                next_bounds.copy(bounds);
                return;
            } // if
            
            if (request_timer) {
                clearTimeout(request_timer);
            };
            
            request_timer = setTimeout(function() {
                // check for empty bounds, if empty then exit
                if ((! bounds) || bounds.isEmpty()) {
                    GRUNT.Log.warn("cannot get pois for empty bounding box");
                    return;
                } // if
            
                // calculate the bounds change
                var bounds_change = null;
                if (! last_bounds.isEmpty()) {
                    bounds_change = new SLICK.Geo.Distance(last_bounds.min, bounds.min);
                } // if
            
                if ((! bounds_change) || self.testBoundsChange(bounds_change)) {
                    GRUNT.Log.info("yep - bounds changed = " + bounds_change);

                    // define the ajax args
                    var ajax_args = GRUNT.extend({
                        method: "POST",
                        success: function(data, textStatus, raw_request) {
                            try {
                                GRUNT.Log.info("received data: " + data);
                                
                                // update the pois
                                updatePOIs(self.parseResponse(data, textStatus, raw_request));
                                request_active = false;
                            
                                if (callback) {
                                    callback(self.pois);
                                } // if
                            
                                // if we have a next request, then execute that request
                                request_timer = 0;
                                if (! next_bounds.isEmpty()) {
                                    self.getForBounds(next_bounds, callback);
                            
                                    // update the next bounds to empty
                                    next_bounds.clear();
                                } // if
                            }  
                            catch (e) {
                                GRUNT.Log.exception(e);
                            } // try..catch
                        },
                        error: function(raw_request, textStatus, errorThrown) {
                            request_active = false;
                            GRUNT.Log.error("failed getting POIS from server: " + textStatus + ":" + errorThrown);
                        }
                    }, self.initRequest());
                
                    // update the last bounds called and flag the request as active
                    last_bounds.copy(bounds);
                    if (ajax_args.url) {
                        request_active = true;
                
                        SLICK.errorWatch("POI SEARCH REQUEST", function() {
                            // make the request
                            GRUNT.Log.info("Looking for POIS within bounding box: " + bounds);
                            GRUNT.XHR.ajax(ajax_args);
                        });
                    } 
                    else {
                        GRUNT.Log.error("Unable to locate POIS: No search url specified.");
                    } // if..else
                
                } // if
            }, 500);
        },
        
        initRequest: function() {
            return self.args.onInitRequest ? self.args.onInitRequest() : {};
        },
        
        parseResponse: function(data, textStatus, raw_request) {
            return self.args.onParseResponse ? self.args.onParseResponse(data, textStatus, raw_request) : [];
        },
        
        requestUpdates: function(callback) {
            update_listeners.push(callback);
        },
        
        testBoundsChange: function(distance) {
            GRUNT.Log.info("testing for bounds change: distance = " + distance);
            
            // if the distance is equal to 0 don't call event, just return false
            if (distance && (distance.toKM() == 0)) { return false; }
            
            return self.args.onCheckBounds ? self.args.onCheckBounds(distance) : true;
        }
    };
    
    return self;
}; // SLICK.Geo.POIProvider
