var Dropzones = (function() {
	var Dropzones = {
		init:Dropzones__init,
		padAgent:Dropzones__padAgent,
		cleanup:Dropzones__cleanup
	};
	
	// setup
	function Dropzones__init(container) {
		container.innerHTML = '<table class="link-ap-env"><tr><td class="dropcolumn"></td><td class="dropcolumn defcolumn"><div class="dropzone"></div></td><td class="dropcolumn"></td></tr></table>';

		container.addEventListener('drop', Dropzones__onDrop);
		container.addEventListener('dragover', Dropzones__onDragover);
		container.addEventListener('dragleave', Dropzones__onStopdrag);
		container.addEventListener('dragend', Dropzones__onStopdrag);
	}
	
	function Dropzones__onDrop(evt) {
		if (!evt.target.classList.contains('dropzone') && !evt.target.classList.contains('dropcolumn')) {
			return;
		}
		evt.stopPropagation(); // no default behavior (redirects)
		//evt.preventDefault();
		Dropzones__onStopdrag();

		var request = null;
		var data = evt.dataTransfer.getData('application/link+json');
		if (data) {
			request = JSON.parse(data);
		} else {
			data = evt.dataTransfer.getData('text/uri-list');
			if (data) {
				request = { method:'get', uri:data, accept:'text/html' };
			}
		}

		if (!request) {
			console.log('Bad data provided on RequestEvents drop handler', except, evt);
			return;
		}

		var target = Dropzones__prepareDropTarget(evt.target);
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
		target.dispatchEvent(re);
		return false;
	}

	function Dropzones__onDragover(e) {
		e.preventDefault && e.preventDefault(); // dont cancel the drop
		e.dataTransfer.dropEffect = 'link';
		if (e.target.classList.contains('dropzone') || e.target.classList.contains('dropcolumn')) {
			e.target.classList.add('drophover');
		}
		return false;
	}

	function Dropzones__onStopdrag(e) {
		Array.prototype.forEach.call(document.querySelectorAll('.dropcolumn, .dropzone'), function(dropzone) {
			dropzone.classList.remove('drophover');
		});
	}

	// ensures that new agents have homes
	function Dropzones__prepareDropTarget(target) {
		// get/create target dropzone
		var column, dropzone;
		if (target.classList.contains('dropcolumn')) {
			column = target;
			if (target.hasChildNodes() === false) {
				// we need a dropzone to act as the target
				dropzone = document.createElement('div');
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
		var dropzone;
		if (!agent_elem.parentNode.classList.contains('dropcolumn')) {
			return; // leave subagents alone
		}
		// make sure it has an empty dropcolumn on both sides
		var column = agent_elem.parentNode;
		if (column.previousSibling === null || column.previousSibling.childNodes.length !== 0) {
			var col_left = document.createElement('td');
			col_left.classList.add('dropcolumn');
			column.parentNode.insertBefore(col_left, column);
		}
		if (column.nextSibling === null || column.nextSibling.childNodes.length !== 0) {
			var col_right = document.createElement('td');
			col_right.classList.add('dropcolumn');
			column.parentNode.insertBefore(col_right, column.nextSibling);
		}
		// make sure it has a dropzone above and below it
		if (!agent_elem.previousSibling || !agent_elem.previousSibling.classList.contains('dropzone')) {
			dropzone = document.createElement('div');
			dropzone.className = "dropzone";
			agent_elem.parentNode.insertBefore(dropzone, agent_elem);
		}
		if (!agent_elem.nextSibling || !agent_elem.nextSibling.classList.contains('dropzone')) {
			dropzone = document.createElement('div');
			dropzone.className = "dropzone";
			agent_elem.parentNode.insertBefore(dropzone, agent_elem.nextSibling);
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
})();