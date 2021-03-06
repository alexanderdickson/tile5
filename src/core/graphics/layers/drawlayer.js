/**
# LAYER: Draw
*/
reg('layer', 'draw', function(view, panFrame, container, params) {
    params = cog.extend({
        zindex: 10
    }, params);
    
    // initialise variables
    var storage,
        sortTimeout = 0,
        resyncCallbackId;
        
    /* private functions */
    
    function dragObject(dragData, dragX, dragY, drop) {
        var dragOffset = this.dragOffset;
        
        // if the drag offset is unknown then calculate
        if (! dragOffset) {
            dragOffset = this.dragOffset = new view.XY(
                dragData.startX - this.xy.x, 
                dragData.startY - this.xy.y
            );
        } // if

        // update the xy and accounting for a drag offset
        this.xy.x = dragX - dragOffset.x;
        this.xy.y = dragY - dragOffset.y;
        
        if (drop) {
            delete this.dragOffset;
            view.invalidate();
            
            // resyncronize the xy of the dropped object
            this.xy.sync(view, true);
            
            // trigger the drag drop operation
            this.trigger('dragDrop');
        } // if
        
        return true;
    } // dragObject
    
    /* event handlers */
    
    function handleItemMove(evt, drawable, newBounds, oldBounds) {
        if (storage) {
            // remove the item from the tree at the specified position
            if (oldBounds) {
                storage.remove(oldBounds, drawable);
            } // if

            // add the item back to the tree at the new position
            storage.insert(newBounds, drawable);
        } // if
    } // handleItemMove
    
    function handleRemoved(evt) {
        // kill the storage
        storage = null;
        
        // unbind the resync handler
        view.unbind('resync', resyncCallbackId);
    } // handleLayerRemove
    
    function handleResync(evt) {
        // get the current drawables
        var drawables = storage ? storage.all() : [];
        
        // create the storage with an appropriate cell size
        storage = createStoreForZoomLevel(view.zoom(), storage); // TODO: populate with the previous storage

        // iterate through the shapes and resync to the grid
        for (var ii = drawables.length; ii--; ) {
            drawables[ii].resync();
        } // for
    } // handleParentChange
    
    /* exports */
    
    /**
    ### clear()
    */
    function clear() {
        // if we have storage, then clear
        // if we don't then the layer has been removed, and nothing should be done
        if (storage) {
            // reset the storage
            storage.clear();
            _this.trigger('cleared');

            // invalidate the view
            view.invalidate();
        } // if
    } // clear
    
    /**
    ### create(type, settings, prepend)
    */
    function create(type, settings, prepend) {
        var drawable = regCreate(typeDrawable, type, view, _this, settings);

        // add the the shapes array
        drawable.resync();
        if (storage && drawable.bounds) {
            storage.insert(drawable.bounds, drawable);
        } // if

        // attach a move event handler
        drawable.bind('move', handleItemMove);
        drawable.trigger('created');

        // update the item count
        _this.trigger(type + 'Added', drawable);
        
        // return the drawable
        return drawable;
    } // create
    
    /**
    ### draw(renderer, viewport, view, tickCount, hitData)
    */
    function draw(renderer, viewport, view, tickCount, hitData) {
        var emptyProps = {
            },
            drawItems = storage && viewport ? storage.search(viewport): [];
            
        // iterate through the draw items and draw the layers
        for (var ii = drawItems.length; ii--; ) {
            var drawable = drawItems[ii],
                overrideStyle = drawable.style || _this.style, 
                styleType,
                previousStyle,
                transform,
                drawProps = drawable.getProps ? drawable.getProps(renderer) : emptyProps,
                prepFn = renderer['prep' + drawable.typeName],
                drawFn,
                drawData;

            // if the drawable has tweens, then apply them
            if (drawable.tweens.length > 0) {
                drawable.applyTweens();
            } // if
            
            transform = renderer.applyTransform(drawable);
            drawData = drawable.visible && prepFn ? prepFn.call(renderer, 
                drawable,
                viewport,
                hitData,
                drawProps) : null;
                    
            // prep the path for the child
            if (drawData) {
                // if the element has been hit then update
                if (hitData && drawData.hit) {
                    hitData.elements.push(T5.Hits.initHit(
                        drawable.type, 
                        drawable, 
                        drawable.draggable ? dragObject : null)
                    );

                    // init the style type to match the type of event
                    styleType = hitData.type + 'Style';

                    // now update the override style to use the specified style if it exists
                    overrideStyle = drawable[styleType] || _this[styleType] || overrideStyle;
                } // if

                // save the previous style
                previousStyle = overrideStyle ? renderer.applyStyle(overrideStyle, true) : null;
                
                // get the draw function (using the drawable override if defined)
                drawFn = drawable.draw || drawData.draw;
                
                // if we have a draw function then run it
                if (drawFn) {
                    drawFn.call(drawable, drawData);
                } // if
                
                // if we have a previous style, then restore that style
                if (previousStyle) {
                    renderer.applyStyle(previousStyle);
                } // if
            } // if
            
            // if a transform was applied, then restore the canvas
            if (transform && transform.undo) {
                transform.undo();
            } // if
        } // for
    } // draw
    
    /**
    ### find(selector: String)
    The find method will eventually support retrieving all the shapes from the shape
    layer that match the selector expression.  For now though, it just returns all shapes
    */
    function find(selector) {
        return storage.all();
    } // find    
    
    /**
    ### hitGuess(hitX, hitY, view)
    Return true if any of the markers are hit, additionally, store the hit elements
    so we don't have to do the work again when drawing
    */
    function hitGuess(hitX, hitY, view) {
        return storage && storage.search({
            x: hitX - 5, 
            y: hitY - 5, 
            w: 10,
            h: 10
        }).length > 0;
    } // hitGuess
    
    /* initialise _this */
    
    var _this = cog.extend(new ViewLayer(view, panFrame, container, params), {
        clear: clear,
        create: create,
        draw: draw,
        find: find,
        hitGuess: hitGuess
    });
    
    // bind to refresh events as we will use those to populate the items to be drawn
    resyncCallbackId = view.bind('resync', handleResync);
    
    // handle the layer being removed
    _this.bind('removed', handleRemoved);
    
    return _this;
});