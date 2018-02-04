{
"use strict";

window.sodium = { onload: function(sodium) {
	scrypt_module_factory(scrypt => {
		let IMK = null;

		function base64url_encode(str)
		{
			return sodium.to_base64(sodium.from_string(str));
		}
		function getPostData(href)
		{
			if (typeof href == "string" && href.startsWith("sqrl://"))
			{
				let hurl = new URL(href.replace(/^sqrl:/, 'https:'));
				if (hurl != null && isValidHostname(hurl.hostname))
				{
					if (IMK == null)
						return {"success": false, "errorCode": "ERRPD003"};
					else
					{
						let HMAC256Hash = sodium.crypto_auth_hmacsha256(hurl.hostname, IMK);

						let { publicKey: SitePublicKey,  privateKey: SitePrivateKey } = sodium.crypto_sign_seed_keypair(HMAC256Hash);
						sodium.memzero(HMAC256Hash);

						let client = base64url_encode([
							"ver=1",
							"cmd=ident",
							"idk=" + sodium.to_base64(SitePublicKey),
							"opt=cps",
							"" //keep this empty string for trailing \r\n
						].join("\r\n"));
						sodium.memzero(SitePublicKey);

						let server = base64url_encode(href);
						let ids = sodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
						sodium.memzero(SitePrivateKey);

						return {"success": true, "postData": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&')};
					}
				}
				else
					return {"success": false, "errorCode": "ERRPD002"};
			}
			else
				return {"success": false, "errorCode": "ERRPD001"};
		}
		function importIdentity(textualIdentity, rescueCode, sendResponse)
		{
			//FIXME: check that length of textual identity corresponds to a valid type2 or type2+type3 block
			// ... the following pre-calculated fixed character counts may be used: 107, 185, 232, 278, 325 for the five possible textual identity lengths (spaces and newlines removed).
			let validationResult = validateTextualIdentity(textualIdentity); //will also return success == true if the textual identity is only partly entered!
			if (validationResult.success)
			{
				let identityData = base56decode(textualIdentity.replace(/[\t ]/g,'').replace(/.(\r?\n|$)/g, "")).toArrayLike(Uint8Array).reverse();
				console.log("identityData", JSON.stringify(Array.from(identityData)), identityData.length);
				let blockSize = ab2int(identityData.slice(0, 2));
				let blockType = ab2int(identityData.slice(2, 4));
				if (blockType == 2)
				{
					let extractedBlock2 = parseBlockType2(identityData.slice(0, blockSize));
					console.log("extractedBlock2", extractedBlock2);
					console.log("rescueCode", JSON.stringify(Array.from(rescueCode)), rescueCode.length);
					let enscryptedPwd = enscrypt(scrypt.crypto_scrypt, str2ab(rescueCode.replace(/[^0-9]/g, "")), extractedBlock2.enscryptSalt, extractedBlock2.enscryptIter);
					console.log("enscryptedPwd", JSON.stringify(Array.from(enscryptedPwd)));
					aesGcmDecrypt(extractedBlock2.dataToDecrypt, extractedBlock2.additionalData, enscryptedPwd, new Uint8Array(12)).then(decrypted => {
						let IUK = new Uint8Array(decrypted);
						console.log("IUK", IUK);
						IMK = enhash(IUK);
						//FIXME: encrypt IMK with password
						chrome.storage.local.set({"IMK": IMK});
						sendResponse({"success": true});
					}).catch(err => {
						sendResponse({"success": false, "errorCode": "ERRII002"});
					});
				}
				else
					return "ERRII001";
			}
			else
			{
				return "ERRII000";
			}
		}

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			if (sender.tab) //from content, TODO: CHECK THAT THIS IS SAFE
			{
				if (request.action === "getPostData")
				{
					let result = getPostData(request.href);
					sendResponse(result);
					chrome.browserAction.setBadgeText({"text": result.success ? "" : "Error", "tabId": sender.tab.id});
				}
			}
			else //from popup
			{
				if (request.action === "hasIdentity")
				{
					sendResponse(IMK != null);
				}
				else if (request.action === "eraseIdentity")
				{
					IMK = null;
					chrome.storage.local.remove("IMK", () => {
						sendResponse(chrome.runtime.lastError);
					});
					return true;
				}
				else if (request.action === "importIdentity")
				{
					let errorCode = importIdentity(request.textualIdentity, request.rescueCode, sendResponse);
					if (errorCode)
						sendResponse({"success": false, "errorCode": errorCode });
					else
						return true; // so importIdentity() can use sendResponse() asynchronously
				}
			}
		});

		// init
		chrome.storage.local.get("IMK", function(result){
			if (result.IMK)
				IMK = result.IMK;
		});
	});
}};
var scrpt = document.createElement("script");
scrpt.setAttribute("src", "sodium-asmjs.js");
document.getElementsByTagName('head')[0].appendChild(scrpt);

}
