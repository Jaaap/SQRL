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
		}
	}
}

//assume DOMLoaded
[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
	anchor.addEventListener("click", onAnchorClick, false);
});

}
