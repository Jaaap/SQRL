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
					console.log("content", "onAnchorClick", "ERRAC001");
			});
			//var anchor = $('#sqrl')
			//draw arrow from anchor to top right of screen
			var rect = anchor.getBoundingClientRect();
			//coordinates relative to top left corner of documentElement
			var x1 = rect.right;
			var y1 = rect.top;
			var x2 = document.documentElement.clientWidth - 24;
			var y2 = 0;
			var dx = x2 - x1;
			var dy = y2 - y1;
			var l = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
			var a = Math.atan(dy / dx);
console.log(x1, y1, x2, y2, l);
			var arrow = document.createElement("div");
			var shaft = document.createElement("hr");
			var tip = document.createElement("span");
			arrow.style.cssText = `
position: absolute;
z-index: 99999;
left: ${x1 + document.documentElement.scrollLeft}px;
top: ${y1 + document.documentElement.scrollTop}px;
width: ${l}px;
transform: rotate(${a}rad);
transform-origin: bottom left;
`;
			shaft.style.cssText = `
height: 2px;
width: ${l - 15}px;
border: 0 none;
background-color: #007CC3;
box-shadow: 0 0 4px #FFF;
`;
			tip.style.cssText = `
position: absolute;
right: 0;
top: -7px;
height: 0;
width: 0;
display: inline-block;
border-top: 8px solid transparent;
border-bottom: 8px solid transparent;
border-left: 16px solid #007CC3;
`;
			arrow.appendChild(shaft);
			arrow.appendChild(tip);
			document.body.appendChild(arrow);
			setTimeout(() => { document.body.removeChild(arrow); }, 1000);
		}
	}
}

//assume DOMLoaded
[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
	anchor.addEventListener("click", onAnchorClick, false);
});

}
