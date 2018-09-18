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
			//draw arrow from anchor to top right of screen
			var rect = anchor.getBoundingClientRect();
			//coordinates relative to top left corner of documentElement
			var x1 = rect.right;
			var y1 = rect.top;
			var x2 = document.documentElement.clientWidth + document.documentElement.scrollLeft;
			var y2 = document.documentElement.scrollTop;
			var dx = x2 - x1;
			var dy = y2 - y1;
			var l = Math.sqrt(Math.pow(dx, 2), Math.pow(dy, 2));
			var a = Math.atan(dy / dx);
console.log(x1, y1, x2, y2, l);
			var hr = document.createElement("hr");
			hr.style.cssText = `position: absolute; border: 0 none; z-index: 99999; height: 2px; background-color: #007CC3; top: ${y1}px; left: ${x1}px; width: ${l}px; transform: rotate(${a}rad); transform-origin: bottom left;`;
			document.body.appendChild(hr);
			setTimeout(() => { document.body.removeChild(hr); }, 1000);
		}
	}
}

//assume DOMLoaded
[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
	anchor.addEventListener("click", onAnchorClick, false);
});

}
