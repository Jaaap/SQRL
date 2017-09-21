{
"use strict";

function base64url_decode(data)
{
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
	let req = new XMLHttpRequest();
	req.addEventListener("load", evt => {
		callback(req.responseText);
	});
	req.addEventListener("error", evt => {
		console.error("ajax", req.status, req.reponseText);
	});
	//FIXME: prevent redirects
	req.open("POST", url, true);
	req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	req.send(postData);
}

function onAjaxCallback(responseText)
{
	console.log("onAjaxCallback", responseText);
	let responseLines = base64url_decode(responseText).split("\r\n");
	console.log("onAjaxCallback", responseLines);
	let foundUrl = false;
	responseLines.forEach(line => {
		if (line.startsWith("url="))
		{
			document.location.href = line.substring(4);
			foundUrl = true;
		}
	});
	if (!foundUrl)
		console.error("onAjaxCallback", "No url found in server response");
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
		chrome.runtime.sendMessage({"action": "getPostData", "href": anchor.href}, postData => {
			console.log(postData);
			ajax(anchor.href.replace(/^sqrl:/, 'https:'), postData, onAjaxCallback);
		});
	}
}
function init()
{
	//assume DOMLoaded
	[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
		anchor.addEventListener("click", onAnchorClick, false);
	});
}
init();
/*
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse)
{
	if (message.type === 'fillLoginForm')
	{
		return sendResponse(true);
	}
});


*/
}
