{
"use strict";
//console.log(new Date().getTime());
chrome.runtime.onMessage.addListener(request => {
	console.log(request);
	if (request && request.action == "printIdentity")
	{
		document.querySelector('#identity').textContent = request.textualIdentity;
		document.querySelector('#rescuecode').textContent = request.rescueCode;
		window.print();
	}
});
}
