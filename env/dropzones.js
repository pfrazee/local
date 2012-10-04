var Dropzones = (function() {
	var Dropzones = {
		init:Dropzones__init,
		padAgent:Dropzones__padAgent,
		cleanup:Dropzones__cleanup
	};
	
	// setup
	function Dropzones__init(container) {
		var table = document.createElement('table');
		table.innerHTML = '<tr><td class="dropcolumn"></td><td class="dropcolumn defcolumn"><div class="dropzone"></div></td><td class="dropcolumn"></td></tr>';
		container.appendChild(table);

		document.body.addEventListener('drop', Dropzones__onDrop);
		document.body.addEventListener('dragover', Dropzones__onDragover);
		document.body.addEventListener('dragleave', Dropzones__onStopdrag);
		document.body.addEventListener('dragend', Dropzones__onStopdrag);
	}
	
	function Dropzones__onDrop(evt) {
		if (!evt.target.classList.contains('dropzone') && !evt.target.classList.contains('dropcolumn')) {
			return;
		}
		evt.stopPropagation(); // no default behavior (redirects)
		evt.preventDefault();

		var request;
		try {
			request = JSON.parse(evt.dataTransfer.getData('application/link+json'));
		} catch (except) {
			console.log('Bad data provided on Dropzones drop handler', except, evt);
		}

		request.target = Dropzones__prepareDropTarget(evt.target);
		var re = new CustomEvent('request', { bubbles:true, cancelable:true, detail:{ request:request }});
		request.target.dispatchEvent(re);
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