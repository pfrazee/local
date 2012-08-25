define(['env/event-emitter'], function(EventEmitter) {
    var Dropzones = {
        init:Dropzones__init,
        padAgent:Dropzones__padAgent,
        cleanup:Dropzones__cleanup
    };
    EventEmitter.mixin(Dropzones);
    
    // setup
    function Dropzones__init() {
        document.body.addEventListener('drop', Dropzones__onDrop, false);
        document.body.addEventListener('dragover', Dropzones__onDragover, false);
        document.body.addEventListener('dragleave', Dropzones__onStopdrag, false);
        document.body.addEventListener('dragend', Dropzones__onStopdrag, false);
    }
    
    function Dropzones__onDrop(evt) {
        if (!evt.target.classList.contains('dropzone') && !evt.target.classList.contains('dropcolumn')) {
            return;
        }
        evt.stopPropagation && evt.stopPropagation(); // no default behavior (redirects)

        try {
            var link = JSON.parse(evt.dataTransfer.getData('application/link+json'));
        } catch (except) {
            console.log('Bad data provided on RequestEvents drop handler', except, evt);
        }

        link.target = Dropzones__prepareDropTarget(evt.target);
        Dropzones.emitEvent('request', link);
        return false;
    }

    function Dropzones__onDragover(e) {
        e.preventDefault && e.preventDefault(); // dont cancel the drop
        e.dataTransfer.dropEffect = 'link';
        if (e.target.classList.contains('dropzone') || e.target.classList.contains('dropcolumn')) {
            e.target.classList.add('request-hover');
        }
        return false;
    }

    function Dropzones__onStopdrag(e) {
        Array.prototype.forEach.call(document.querySelectorAll('.dropcolumn, .dropzone'), function(dropzone) {
            dropzone.classList.remove('request-hover');
        });
    }

    // ensures that new agents have homes
    function Dropzones__prepareDropTarget(target) {
        // get/create target dropzone
        var column, dropzone;
        if (target.classList.contains('dropcolumn')) {
            column = target;
            if (target.hasChildNodes() == false) {
                // we need a dropzone to act as the target
                var dropzone = document.createElement('div');
                dropzone.classList.add('dropzone');
                column.appendChild(dropzone);

                // also, will need drop-columns around it
                var col_left = document.createElement('td');
                col_left.classList.add('dropcolumn');
                column.parentNode.insertBefore(col_left, column);
                var col_right = document.createElement('td');
                col_right.classList.add('dropcolumn');
                column.parentNode.insertBefore(col_right, column.nextSibling);
            } else {
                dropzone = column.lastChild;
            }
        } else {
            dropzone = target;
            column = dropzone.parentNode;
        }

        // create agent's future home
        var agent_elem = document.createElement('div');
        column.insertBefore(agent_elem, dropzone);
       
        return agent_elem;
    }

    function Dropzones__padAgent(agent_elem) {
        // make sure it has a dropzone above it
        if (!agent_elem.prevSibling || !agent_elem.prevSibling.classList.contains('dropzone')) {
            var dropzone = document.createElement('div');
            dropzone.className = "dropzone";
            agent_elem.parentNode.insertBefore(dropzone, agent_elem);
        }
    }

    // removes extraneous dropzones after an agent is removed
    function Dropzones__cleanup(dropzone) {
        var column = dropzone.parentNode;
        column.removeChild(dropzone);
        if (column.children.length == 1) { // just the one dropzone left?
            column.parentNode.removeChild(column.nextSibling); // remove trailing dropcolumn
            column.parentNode.removeChild(column); // remove dropcolumn
        }
    }

    return Dropzones;
});
