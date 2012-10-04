// Content Types
// =============
// tools to manage content types

if (typeof ContentTypes == 'undefined') {
	(function() {
		var ContentTypes = globals.ContentTypes = {};
		var serializers = {};
		var deserializers = {};

		ContentTypes.serialize = function serialize(obj, type) {
			if (!obj || typeof(obj) != 'object' || !type) {
				return obj;
			}
			var fn = __find(serializers, type);
			if (!fn) {
				Util.log('err_types', 'Unable to serialize', type, '(no serializer found)');
				return obj;
			}
			return fn(obj);
		};
		ContentTypes.deserialize = function deserialize(str, type) {
			if (!str || typeof(str) != 'string' || !type) {
				return str;
			}
			var fn = __find(deserializers, type);
			if (!fn) {
				Util.log('err_types', 'Unable to deserialize', type, '(no deserializer found)');
				return str;
			}
			return fn(str);
		};

		ContentTypes.setSerializer = function setSerializer(type, fn) {
			serializers[type] = fn;
		};
		ContentTypes.setDeserializer = function setDeserializer(type, fn) {
			deserializers[type] = fn;
		};

		// takes a mimetype (text/asdf+html), puts out the applicable types ([text/asdf+html, text/html,text])
		function __mkTypesList(type) {
			var parts = type.split(';');
			var t = parts[0];
			parts = t.split('/');
			if (parts[1]) {
				var parts2 = parts[1].split('+');
				if (parts2[1]) {
					return [t, parts[0] + '/' + parts2[1], parts[0]];
				}
				return [t, parts[0]];
			}
			return [t];
		}

		function __find(registry, type) {
			var types = __mkTypesList(type);
			for (var i=0; i < types.length; i++) {
				if (types[i] in registry) { return registry[types[i]]; }
			}
			return null;
		}

		ContentTypes.setSerializer('application/json', function(obj) {
			return JSON.stringify(obj);
		});
		ContentTypes.setDeserializer('application/json', function(str) {
			try {
				var obj = JSON.parse(str);
				return obj;
			} catch (e) {
				console.log('application/json decode failed', e);
				return {};
			}
		});
		ContentTypes.setSerializer('application/x-www-form-urlencoded', function(obj) {
			var enc = encodeURIComponent;
			var str = [];
			for (var k in obj) {
				if (obj[k] === null) {
					str.push(k+'=');
				} else if (Array.isArray(obj[k])) {
					for (var i=0; i < obj[k].length; i++) {
						str.push(k+'[]='+enc(obj[k][i]));
					}
				} else if (typeof obj[k] == 'object') {
					for (var k2 in obj[k]) {
						str.push(k+'['+k2+']='+enc(obj[k][k2]));
					}
				} else {
					str.push(k+'='+enc(obj[k]));
				}
			}
			return str.join('&');
		});
		ContentTypes.setDeserializer('application/x-www-form-urlencoded', function(params) {
			// thanks to Brian Donovan
			// http://stackoverflow.com/a/4672120
			var pairs = params.split('&'),
			result = {};

			for (var i = 0; i < pairs.length; i++) {
				var pair = pairs[i].split('='),
				key = decodeURIComponent(pair[0]),
				value = decodeURIComponent(pair[1]),
				isArray = /\[\]$/.test(key),
				dictMatch = key.match(/^(.+)\[([^\]]+)\]$/);

				if (dictMatch) {
					key = dictMatch[1];
					var subkey = dictMatch[2];

					result[key] = result[key] || {};
					result[key][subkey] = value;
				} else if (isArray) {
					key = key.substring(0, key.length-2);
					result[key] = result[key] || [];
					result[key].push(value);
				} else {
					result[key] = value;
				}
			}

			return result;
		});

	})();
}
