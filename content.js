{
"use strict";

function base64url_decode(data)
{
	if (data.length % 4 > 0)
	{
		//padd width equal signs
		data = data + new Array(5 - (data.length % 4)).join("=");
	}
	let b64u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";   // base64url dictionary
	let dst = "";

	for (let i = 0; i < data.length - 3; i += 4)
	{
		let a = b64u.indexOf(data.charAt(i+0));
		let b = b64u.indexOf(data.charAt(i+1));
		let c = b64u.indexOf(data.charAt(i+2));
		let d = b64u.indexOf(data.charAt(i+3));

		dst += String.fromCharCode((a << 2) | (b >>> 4));
		if (data.charAt(i+2) != '=')
			dst += String.fromCharCode(((b << 4) & 0xF0) | ((c >>> 2) & 0x0F));
		if (data.charAt(i+3) != '=')
			dst += String.fromCharCode(((c << 6) & 0xC0) | d);
	}
	return decodeURIComponent(escape(dst));
}

function ajax(url, postData, callback)
{
//console.log("content.ajax", url, postData);
	fetch(url, {
		"body": postData,
		"cache": "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
		"credentials": "omit", // include, *omit, same-origin
		"headers": {
			"content-type": "application/x-www-form-urlencoded"
		},
		"method": "POST", // *GET, PUT, DELETE, etc.
		"mode": "same-origin", // no-cors, *same-origin, cors
		"redirect": "error" // *manual, follow, error
		//"referer": "client", // *client, no-referrer
	}).then(resp => {
		if (resp.ok) //statusCode == 200
		{
			return resp.text(); //promise
		}
		else
		{
			console.warn("content.ajax", "ERRFE000", "Response statuscode other than 200", resp.status);
			return Promise.reject("ERRFE000");
		}
	}).then(callback)
	.catch(err => {
		console.warn("content.ajax", "ERRFE001", "Network error");
	});
}

function onAjaxCallback(responseText, anchor)
{
//console.log("onAjaxCallback", responseText);
	let responseLines = base64url_decode(responseText).split("\r\n");
//console.log("onAjaxCallback", JSON.stringify(responseLines));
	let responseMap = {};
	for (let line of responseLines)
	{
		let eqPos = line.indexOf("=");
		if (eqPos > -1)
			responseMap[line.substring(0,eqPos)] = line.substr(eqPos + 1);
	}
	if ("url" in responseMap)
		window.location.href = responseMap.url;
	else
		console.warn("content.onAjaxCallback", "ERRAC001", "No url found in server response");
}

function onAnchorClick(evt)
{
	evt.preventDefault();
	let anchor = evt.target;
	while (anchor && anchor.tagName != "A")
		anchor = anchor.parentNode;
	//TODO: check meta/ctrl/middleclick?
	if (anchor.tagName == "A")
	{
		chrome.runtime.sendMessage({"action": "getPostData", "href": anchor.href, "windowLoc": window.location.href}, result => {
			//console.log("content.onAnchorClick", result);
			if (result && result.success)
				ajax(anchor.href.replace(/^sqrl:/, 'https:'), result.postData, respTxt => { onAjaxCallback(respTxt, anchor); });
			else
				console.warn("content.onAnchorClick", "ERRLC001", "Unexpected response from background");
		});
	}
}

//assume DOMLoaded
[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
	anchor.addEventListener("click", onAnchorClick, false);
});
}

