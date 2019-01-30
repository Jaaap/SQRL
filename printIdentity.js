{
"use strict";
browser.runtime.onMessage.addListener(request => {
	if (request && request.action == "printIdentity")
	{
		console.log(request);
		document.querySelector('#identity').textContent = request.textualIdentity;
		document.querySelector('#rescuecode').textContent = request.rescueCode;
		window.print();
	}
});
}
