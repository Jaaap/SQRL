{
"use strict";

function onAnchorClick(evt)
{
	if (evt.isTrusted) //User clicked
	{
		evt.preventDefault();
		let anchor = evt.target;
		while (anchor && anchor.tagName != "A")
			anchor = anchor.parentNode;
		//TODO: check meta/ctrl/middleclick?
		if (anchor.tagName == "A")
		{
			chrome.runtime.sendMessage({"action": "onAnchorClick", "href": anchor.href, "windowLoc": window.location.href}, result => {
				if (result.success && result.url)
					window.location.href = result.url;
				else
					console.warn("content", "onAnchorClick", "ERRAC001");
			});
			//var anchor = $('#sqrl')
			//draw arrow from anchor to top right of screen
			var rect = anchor.getBoundingClientRect();
			//coordinates relative to top left corner of documentElement
			var x1 = rect.right;
			var y1 = rect.top;
			var x2 = document.documentElement.clientWidth - 32;
			var y2 = 50; //0;
			var dx = x2 - x1;
			var dy = y2 - y1;
			var l = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
			var a = Math.atan(dy / dx);
//console.log(x1, y1, x2, y2, dx, dy, l);
			var arrow = document.createElement("div");
			var shaft1 = document.createElement("hr");
			var shaft2 = document.createElement("hr");
			var tip = document.createElement("span");
			arrow.style.cssText = `
all: initial;
position: absolute;
z-index: 99999;
left: ${x1 + document.documentElement.scrollLeft}px;
top: ${y1 + document.documentElement.scrollTop}px;
width: ${dx}px;
`;
			shaft1.style.cssText = `
height: 2px;
width: ${l}px;
transform: rotate(${a}rad);
transform-origin: bottom left;
border: 0 none;
background-color: #007CC3;
box-shadow: 0 0 4px #FFF;
`;
			shaft2.style.cssText = `
position: absolute;
right: 0;
top: ${dy - 19}px;
height: 20px;
width: 2px;
border: 0 none;
background-color: #007CC3;
box-shadow: 0 0 4px #FFF;
`;
			tip.style.cssText = `
position: absolute;
right: -6.5px;
top: ${dy - 33}px;
height: 0;
width: 0;
display: inline-block;
border-left: 8px solid transparent;
border-right: 8px solid transparent;
border-bottom: 16px solid #007CC3;
filter: drop-shadow(0 0 2px #FFF);
`;
			arrow.appendChild(shaft1);
			arrow.appendChild(shaft2);
			arrow.appendChild(tip);
			document.body.appendChild(arrow);
			setTimeout(() => { document.body.removeChild(arrow); }, 2000);
		}
	}
}

function addEvent(anchor)
{
	//console.log("FOUND SQRL LINK", anchor);
	anchor.addEventListener("click", onAnchorClick, false);//anchor may already have this eventListener but it's ok to add it again, see https://www.w3.org/TR/2000/REC-DOM-Level-2-Events-20001113/events.html#Events-EventTarget-addEventListener
}
function addEvents(root, isAttr)
{
	//console.log("adding events to", root);
	if (root.tagName == "A" && /^sqrl:\/\//.test(root.getAttribute("href")))
	{
		addEvent(root);
	}
	else if (!isAttr)
	{
		if (root.nodeType == Node.ELEMENT_NODE || root.nodeType == Node.DOCUMENT_NODE)
		{
			[].forEach.call(root.querySelectorAll('a[href^="sqrl://"]'), addEvent);
		}
	}
}

//assume DOMLoaded
addEvents(document);

//track DOM changes
let observer = new MutationObserver(mutations => {
	for (var mutation of mutations)
	{
		//console.log(mutation);
		if (mutation.type == 'childList')
		{
			[].forEach.call(mutation.addedNodes, addEvents);
		}
		else if (mutation.type == 'attributes')
		{
			addEvents(mutation.target, true);
		}
	}
});
observer.observe(document, { attributes:true, attributeFilter: ["href"], childList: true, subtree: true });

}
