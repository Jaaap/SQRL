{
"use strict";

function base64url(str)
{
	return sodium.to_base64(sodium.from_string(str));
}

function getPostData(href)
{
	if (typeof href == "string" && href.startsWith("sqrl://"))
	{
		//FIXME
		let masterKey = 'F33CCDFAFED8DFD2A2BE0A5B84D435B0641D52BB6BF4D7E3067B12CA4DDB0B32';

		let HMAC256Hash = sodium.crypto_auth_hmacsha256(new URL(href.replace(/^sqrl:/, 'https:')).hostname, sodium.from_hex(masterKey));
		let { publicKey: SitePublicKey,  privateKey: SitePrivateKey } = sodium.crypto_sign_seed_keypair(HMAC256Hash);
		sodium.memzero(HMAC256Hash);

		let client = base64url([
			"ver=1",
			"cmd=ident",
			"idk=" + sodium.to_base64(SitePublicKey),
			"opt=cps",
			"" //keep this empty string for trailing \r\n
		].join("\r\n"));
		sodium.memzero(SitePublicKey);

		let server = base64url(href);
		let ids = sodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
		sodium.memzero(SitePrivateKey);

		return ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&');
	}
	else
		console.error("getPostData", 'argument 1 "href" should be a string starting with "sqrl://"');
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (sender.tab) //from content
	{
		if (request.action === "getPostData")
		{
			sendResponse(getPostData(request.href));
			//chrome.browserAction.setBadgeText({"text": "*", "tabId": sender.tab.id});
		}
	}
/*
	else //from popup
	{
		if (request.action === "vault.get")
		{
			sendResponse(vaultObj.get());
		}
	}
*/
});
}
