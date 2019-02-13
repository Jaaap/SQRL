{
"use strict";

var jqo = function() {};
jqo.prototype = [];
jqo.prototype.filter =	function(sel) { if (typeof sel == "function") { var ret = jqi();  ret._sel = this._sel + "').filter('" + sel; this.each(function(i,elem) { if (sel.call(elem,i,elem)) { ret.push(elem); } }); return ret; }
	else if (sel || sel === "") { var ret = jqi(); this.each(function(i,elem){ if (elem.matches(sel)) { ret.push(elem); } }); return ret; }
	else { this.debug("filter",arguments,"Argument 1 should be a function reference or a selector string"); } return this; };
jqo.prototype.not =		function not(sel) { var ret = jqi(); ret._sel = this._sel + "').not('" + sel; this.each(function(i,elem){ if (!elem.matches(sel)) { ret.push(elem); } }); return ret; };
jqo.prototype.last =	function last(inst) { var self = this; var ret = jqi(); ret.push(self[self.length - 1]); return ret; };
jqo.prototype.add =		function add(inst) { var self = this; inst.each(function(i,elem){ self.push(elem); }); return this; };
jqo.prototype.find =	function find(sel) { var ret = jqi(); ret._sel = this._sel + "').find('" + sel; this.each(function fi(i,elem) { var found = $(sel, elem); for (var j = 0; j < found.length; j++) { ret.push(found[j]); } }); return ret; };
jqo.prototype.parent =	function parent()	{ var ret = jqi(); this.each(function(i,elem) { ret.push(elem.parentNode); }); return ret; };
jqo.prototype.parents =	function parents(sel)	{ var ret = jqi(); ret._sel = this._sel + "').parents('"; this.each(function(i,elem) { while((elem = elem.parentNode) && elem.nodeType < 9){ ret.push(elem); }}); return ret.filter(sel); };
jqo.prototype.clone =	function clone()	{ var ret = jqi(); this.each(function(i,elem) { ret.push(elem.cloneNode(true)); }); return ret; };
jqo.prototype.contents =	function contents()	{ var ret = jqi(); ret._sel = "').contents('"; if (this.length) { var cns = this[0].childNodes; for (var j = 0, len = cns.length; j < len; j++) { ret.push(cns[j]); } } return ret; };
jqo.prototype.map =		function map(callback)	{ var ret = []; ret.get = function(){ return this; }; this.each(function(i,elem) { ret.push(callback.call(elem,i,elem)); }); return ret; };
jqo.prototype.get =		function()	{ return this; };
jqo.prototype.toArray =	function()	{ return Array.from(this); };
jqo.prototype.each =	function each(callback)	{ for (var i = 0; i < this.length; i++) { callback.call(this[i],i,this[i]); } return this; };
jqo.prototype.empty =	function empty()	{ this.each(function(i,elem) { while (elem.firstChild) { elem.removeChild(elem.firstChild); }}); return this; };
jqo.prototype.remove =	function()	{ this.each(function(i,elem) { elem.parentNode.removeChild(elem); }); return this; };
jqo.prototype.appendTo =	function(target)	{ this.each(function(i,elem) { if (target.length) { target[0].appendChild(elem); } else { console.warn("$().appendTo(target): target is undefined."); } }); return this; };
jqo.prototype.css =		function css(key,val)	{ if (typeof key == "string") { if (typeof val == "undefined") { return this[0].style[key]; } else { this.each(function(i,elem) { elem.style[key]=val; }); return this; }} else { this.debug("css",arguments,"Argument 1 should be a string"); }};
jqo.prototype.show =	function show(display, force)	{ this.each(function(i,elem) { elem.style.display = display || ""; if (force && $(elem).currentStyle("display") == "none") {elem.style.display="block";} }); return this; };
jqo.prototype.toggle =	function toggle(on)	{ this.each(function(i,elem) {elem.style.display = typeof on == "boolean" ? (on ? "" : "none") : (elem.style.display=="none" ? "" : "none"); return this; })};
jqo.prototype.hide =	function hide()	{ this.each(function(i,elem) { elem.style.display = "none"; }); return this; };
jqo.prototype.addClass =     function addClass(name)	{ this.each(function(i,elem) { elem.classList.add(name); }); return this; };
jqo.prototype.removeClass =  function removeClass(name)	{ this.each(function(i,elem) { elem.classList.remove(name); }); return this; };
jqo.prototype.toggleClass =  function toggleClass(name,on)	{ this.each(function(i,elem) { if(typeof on != "undefined") { elem.classList[on ? "add" : "remove"](name); } else { elem.classList.toggle(name);} }); return this; };
jqo.prototype.hasClass =     function hasClass(name)	{ return this.length && this[0].classList.contains(name); };
jqo.prototype.val =		function $val(val)	{ if (typeof val == "undefined") { return this.length ? ((this[0].tagName == "SELECT") ? this[0].options[this[0].selectedIndex].value : this[0].value) : ""; } else { this.each(function(j,elem) { if (elem.tagName == "SELECT") { var isArr = Array.isArray(val); for (var i = 0; i < elem.options.length; i++) { var opt = elem.options[i]; if (isArr) { opt.selected = val.indexOf(opt.value) > -1; } else if (opt.value == val) { opt.selected=true; } } }
else if (elem.type == "checkbox" || elem.type == "radio") { elem.checked = val; }
else { elem.value = val; }}); return this; } };
jqo.prototype.text =	function text(txt)	{ if (typeof txt == "undefined") { return this.length ? this[0].value||this[0].textContent : ""; } else { this.each(function(i,elem) { elem.textContent = txt; }); return this; } };
jqo.prototype.cut =		function(act)	{ return this.bind("cut",act); };
jqo.prototype.copy =	function(act)	{ return this.bind("copy",act); };
jqo.prototype.paste =	function(act)	{ return this.bind("paste",act); };
jqo.prototype.undo =	function(act)	{ return this.bind("undo",act); };
jqo.prototype.redo =	function(act)	{ return this.bind("redo",act); };
jqo.prototype.blur =	function(act)	{ return this.bind("blur",act); };
jqo.prototype.focus =	function(act)	{ return this.bind("focus",act); };
jqo.prototype.ready =	function(act)	{ if (/^interactive|complete|loaded$/.test(document.readyState)) { act(); } else { return this.bind("DOMContentLoaded",act); } };
jqo.prototype.click =	function(act)	{ return this.bind("click",act); };
jqo.prototype.keydown =	function(act)	{ return this.bind("keydown",act); };
jqo.prototype.keypress =	function(act)	{ return this.bind("keypress",act); };
jqo.prototype.keyup =	function(act)	{ return this.bind("keyup",act); };
jqo.prototype.submit =	function(act)	{ return this.bind("submit",act); };
jqo.prototype.change =	function(act)	{ return this.bind("change",act); };
jqo.prototype.mouseup =	function(act)	{ return this.bind("mouseup",act); };
jqo.prototype.mouseout =	function(act)	{ return this.bind("mouseout",act); };
jqo.prototype.mousemove =	function(act)	{ return this.bind("mousemove",act); };
jqo.prototype.mouseover =	function(act)	{ return this.bind("mouseover",act); };
jqo.prototype.mousedown =	function(act)	{ return this.bind("mousedown",act); };
jqo.prototype.mouseenter =	function(act)	{ return this.bind("mouseenter",act); };
jqo.prototype.mouseleave =	function(act)	{ return this.bind("mouseleave",act); };
jqo.prototype.touchstart =	function(act)	{ return this.bind("touchstart",act); };
jqo.prototype.touchmove =	function(act)	{ return this.bind("touchmove",act); };
jqo.prototype.touchcancel =	function(act)	{ return this.bind("touchcancel",act); };
jqo.prototype.touchend =	function(act)	{ return this.bind("touchend",act); };
jqo.prototype.resize =	function(act)	{ return this.bind("resize",act); };
jqo.prototype.bind =	function(evtName, callback)	{ if (typeof callback == "function") { this.each(function(i,elem) { elem.addEventListener(evtName,callback,false); }); return this; } else { this.debug("bind",arguments,"Argument 2 should be a function reference but is " + typeof callback); } };
jqo.prototype.trigger =	function(eventType)	{ this.each(function(i,elem) { if (["click", "dblclick", "mouseup", "mousedown"].indexOf(eventType) > -1) { var event = new MouseEvent(eventType, {'view': window,'bubbles': true,'cancelable': true}); elem.dispatchEvent(event); } else { var evt = document.createEvent("Event"); evt.initEvent(eventType, true, true); return !elem.dispatchEvent(evt); } }); return this; };
jqo.prototype.load =	function(url, callback)	{ if (typeof url == "function") { return this.bind("load",url); } else { console.warn("load not implemented for non-functions") } };
jqo.prototype.attr =	function attr(key,val)	{
	if (typeof val == "function") {
		this.each(function ai(i,elem) { elem.setAttribute(key,val(i,elem.getAttribute(key))); }); return this;
	} else if (typeof val != "undefined") {
		this.each(function ai(i,elem) { elem.setAttribute(key,val); }); return this;
	} else {
		if (this.length>0) return this[0].getAttribute(key);
	}
};
jqo.prototype.width =	function width(val)	{ if (typeof val != "undefined") { this.each(function(i,elem) { elem.style.width = val; }); } else return this.currentStyle("width"); };
jqo.prototype.height =	function height(val)	{ if (typeof val != "undefined") { this.each(function(i,elem) { elem.style.height = val; }); } else return this.currentStyle("height"); };
jqo.prototype.offset =	function()	{ if (this.length>0) { var bcr = this[0].getBoundingClientRect(); return {left:bcr.left+window.pageXOffset - document.body.clientLeft, top:bcr.top+window.pageYOffset - document.body.clientTop}; } };
jqo.prototype.debug =	function(fnc, args, str) { var argz = []; for (var i = 0, len = args.length; i < len; i++) { argz.push(JSON.stringify(args[i])||'function'); } console.warn("$('" + this._sel + "')." + fnc + "(" + argz.join(', ') + ")", str); };
jqo.prototype.extend =	function(methods) { for (var name in methods) { jqo.prototype[name] = methods[name]; } };
jqo.prototype.enable =	function(on) { this.each(function(i,elem){ elem.disabled = (typeof on == "undefined") ? false : !on; }); return this; };

function jqi()
{
	return new jqo();
}

var JQL = function JQL(sel, parentNode)
{
	parentNode = parentNode || document;
//console.debug(sel);
	var ret = jqi();
	if (sel != null)
	{
		if (typeof sel == "string")
		{
			//HTML
			if (/^\s*</.test(sel)) {
				console.log('jQueryLight: FIXME: implement $("' + sel + '")');
			} else {
				var checkedMatch = sel.match(/^(.*)\:(checked|selected)$/);
				if (checkedMatch) {
					var elems = parentNode.querySelectorAll(checkedMatch[1]);
					for (var i = 0, len = elems.length; i < len; i++)
						ret.push(elems[i]);
					ret._sel = sel;
					return ret
						.filter(function(i,elem){return elem.checked||elem.selected;});
				} else {
					var elems = parentNode.querySelectorAll(sel);
					for (var i = 0, len = elems.length; i < len; i++)
						ret.push(elems[i]);
					ret._sel = sel;
				}
			}
		}
		else if (Array.isArray(sel) || sel instanceof jqo)
		{
			for (var i = 0, len = sel.length; i < len; i++)
				ret.push(sel[i]);
		}
		else if (typeof sel != "undefined")
		{
			ret.push(sel);
			ret._sel = stringify(sel);
		}
	}
	return ret;
};

JQL.active = 0;
//JQL.fn = extensions;
JQL.fn = jqo.prototype;
JQL.extend = function(target)
{
	if (arguments.length == 1)
	{
		for (var name in target)
			JQL[name] = target[name];
		return JQL;
	}
	else
	{
		for (var i = 1; i < arguments.length; i++)
		{
			var methods = arguments[i];
			for (var name in methods)
				target[name] = methods[name];
		}
		return target;
	}
};

JQL.each = function(object, callback)
{
	var length = object.length;
	if (length === undefined)
		for (var name in object)
			callback.call(object[name], name, object[name]);
	else
		for (var i = 0; i < length; i++)
			callback.call(object[i], i, object[i]);
	return object;
};

var stringify = function(sel)
{
	if (sel.nodeType == 1) //DOM Element
	{
		var tagg = sel.tagName.toLowerCase();
		if (sel.id)
			return tagg + '#' + sel.id;
		else if (sel.className)
			return '*' + tagg + "." + sel.className.replace(/ /,'.') + '*';
		return '*' + tagg + '*';
	}
	if (sel.nodeType == 9) //Document
	{
		return 'document';
	}
	else
		return "FIXME987";
};

window.$ = JQL;
};
