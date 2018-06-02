{
"use strict";
let localSodium = null, textualIdentity = null, partialTextualIdentity = null, sodiumLoadQueue = [], getPostDataQueue = {};
window.sodium = { onload: sod => {
	localSodium = sod;
	for (func of sodiumLoadQueue)
	{
		func();
	}
	sodiumLoadQueue = [];
}};


let savepwd = false;
let IMK = null, passIv = null, passwordEnscrypted = null, passwordEnscryptSalt = null, passwordEnscryptLogN = 9, passwordEnscryptIter = 1;

chrome.storage.local.get(["encrIMK", "passIv", "passwordEnscryptSalt", "savepwd"], function(result){
	if (result.encrIMK && result.passIv && result.passwordEnscryptSalt)
	{
		IMK = new Uint8Array(result.encrIMK);
		passIv = new Uint8Array(result.passIv);
		passwordEnscryptSalt = new Uint8Array(result.passwordEnscryptSalt);
		memzero(result.encrIMK);
		delete result.encrIMK;
	}
	else
		console.info("background.getStorage", "ERRGS000", "encrIMK or passIv or passwordEnscryptSalt not in localStorage");
	if (result.savepwd)
	{
		savepwd = result.savepwd;
	}
});
function setSavepwd(newSavepwd)
{
	savepwd = newSavepwd;
	chrome.storage.local.set({"savepwd": newSavepwd});
}
function hasIMK()
{
	return IMK != null && passIv != null && passwordEnscryptSalt != null;
}
async function getIMK(passwd)
{
	if (!hasIMK())
		throw new Error('ERRGI000', "Missing IMK");
	if (passwd == null && passwordEnscrypted == null)
		throw new Error('ERRGI001', "Missing password");
	if (passwordEnscrypted == null)
	{
		passwordEnscrypted = await enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, passwd, passwordEnscryptSalt, passwordEnscryptLogN, passwordEnscryptIter, (step, max) => {});
	}
	if (passwordEnscrypted.length !== 32)
	{
		memzero(passwordEnscrypted);
		console.warn("background.getIMK", "ERRGI002", "Length of passwordEnscrypted should be 32");
		throw new Error('ERRGI002', "Length of passwordEnscrypted should be 32");
	}

	try
	{
		let decryptedIMK = await aesGcmDecrypt(IMK, null, passwordEnscrypted, passIv);
		if (!savepwd)
		{
			memzero(passwordEnscrypted);
			passwordEnscrypted = null;
		}
		return decryptedIMK;
	}
	catch (err)
	{
		memzero(passwordEnscrypted);
		passwordEnscrypted = null;
		console.warn("background.getIMK", "ERRGI003");
		throw new Error('ERRGI003', "Wrong password");
	}
}
async function setIMK(newIMK, newPasswordAB)
{
	if (newIMK.constructor !== Uint8Array || newIMK.length !== 32)
		throw new Error('ERRSI000', 'Argument 1 "newIMK" should be a Uint8Array of length 32');
	if (newPasswordAB.constructor !== Uint8Array)
		throw new Error("ERRSI001", 'Argument 2 "newPasswordAB" should be a Uint8Array');
	let newPasswordEnscryptSalt = localSodium.randombytes_buf(16);
	let enscryptedNewPassword = await enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, newPasswordAB, newPasswordEnscryptSalt, passwordEnscryptLogN, passwordEnscryptIter, (step, max) => {});
	memzero(newPasswordAB);
	if (enscryptedNewPassword.length !== 32)
		throw new Error("ERRSI003", "Length of enscryptedNewPassword should be 32");
	let newPassIv = localSodium.randombytes_buf(12); //FIXME: or we could use crypto.getRandomValues(new Uint8Array(12)), which is better?
	let newEncrptdIMK = await aesGcmEncrypt(newIMK, null, enscryptedNewPassword, newPassIv);
	memzero(newIMK);
	if (savepwd)
		passwordEnscrypted = enscryptedNewPassword;
	else
		memzero(enscryptedNewPassword);
	IMK = newEncrptdIMK;
	passIv = newPassIv;
	passwordEnscryptSalt = newPasswordEnscryptSalt;
	chrome.storage.local.set({"encrIMK": Array.from(newEncrptdIMK), "passIv": Array.from(newPassIv), "passwordEnscryptSalt": Array.from(newPasswordEnscryptSalt)});
	return { success: true };
}
function eraseIMK()
{
	memzero(IMK);
	IMK = null;
	chrome.storage.local.remove(["encrIMK"], () => {});
}
function erasePasswordEnscrypted()
{
	if (passwordEnscrypted != null)
	{
		memzero(passwordEnscrypted);
	}
	passwordEnscrypted = null;
}
function hasPassword()
{
	return passwordEnscrypted != null;
}


function getPostDataAsync(href, windowLoc, passwdFromPopupAB, callback, tabId)
{
//console.log("backgroud.getPostDataAsync", href, windowLoc);
	if (passwdFromPopupAB != null && passwdFromPopupAB.constructor !== Uint8Array)
		throw new Error('Argument 3 "passwdFromPopup" should be a Uint8Array or null');
	if (typeof href == "string" && href.startsWith("sqrl://"))
	{
		let hurl = new URL(href.replace(/^sqrl:/, 'https:'));
		if (hurl != null && isValidHostname(hurl.hostname))
		{
			let wurl = new URL(windowLoc);
			if (wurl != null && isValidHostname(wurl.hostname))
			{
				if (hurl.origin === wurl.origin)
				{
					if (hasIMK())
					{
						if (hasPassword() || passwdFromPopupAB != null)
						{
							showBadgeError("", 0, tabId);
							let work1 = (href, hurl, passwdFromPopupAB) => {
								getIMK(passwdFromPopupAB).then(currIMK => {
									let HMAC256Hash = localSodium.crypto_auth_hmacsha256(hurl.hostname, currIMK);
/*
crypto.subtle.importKey("raw", getIMK(), {"name": "HMAC", "hash": "SHA-256"}, false, ["sign"]).then(key => crypto.subtle.sign({"name": "HMAC", "hash": "SHA-256"}, key, str2ab(hurl.hostname))).then(HMAC256Hash2 => {
console.log(new Uint8Array(HMAC256Hash2));
});
*/

									let { publicKey: SitePublicKey, privateKey: SitePrivateKey } = localSodium.crypto_sign_seed_keypair(HMAC256Hash);
									memzero(HMAC256Hash);

									let client = base64url_encode([
										"ver=1",
										"cmd=ident",
										"idk=" + localSodium.to_base64(SitePublicKey),
										"opt=cps",
										"" //keep this empty string for trailing \r\n
									].join("\r\n"));
									memzero(SitePublicKey);

									let server = base64url_encode(href);
									let ids = localSodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
									memzero(SitePrivateKey);

									callback({"success": true, "href": href, "postData": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&')});
								}).catch(err => {
									console.warn("background.getPostDataAsync", "ERRPD008", "getIMK failed");
									callback({"success": false, "errorCode": "ERRPD008"});
								});
							};
							if (localSodium == null) //Fennec
							{
								sodiumLoadQueue.push(function(){ work1(href, hurl, passwdFromPopupAB); });
							}
							else
							{
								work1(href, hurl, passwdFromPopupAB);
							}
							return false;
						}
						else
						{
							showBadgeError("PASS", 6, tabId);
							console.warn("background.getPostDataAsync", "ERRPD006", "Missing password");
							callback({"success": false, "errorCode": "ERRPD006"});
							return true;
						}
					}
					else
					{
						showBadgeError("IDTY", 6, tabId);
						console.warn("background.getPostDataAsync", "ERRPD005", "Missing identity");
						callback({"success": false, "errorCode": "ERRPD005"});
						return true;
					}
				}
				else
				{
					showBadgeError("COA", 0, tabId);
					console.warn("background.getPostDataAsync", "ERRPD004", "Cross-Origin Authentication attempt");
					callback({"success": false, "errorCode": "ERRPD004"});
					return true;
				}
			}
			else
			{
				console.warn("background.getPostDataAsync", "ERRPD003", "Invalid window location");
				callback({"success": false, "errorCode": "ERRPD003"});
				return true;
			}
		}
		else
		{
			console.warn("background.getPostDataAsync", "ERRPD002", "Invalid link location");
			callback({"success": false, "errorCode": "ERRPD002"});
			return true;
		}
	}
	else
	{
		console.warn("background.getPostDataAsync", "ERRPD001", "Invalid sqrl link");
		callback({"success": false, "errorCode": "ERRPD001"});
		return true;
	}
}
function createIdentity(sendResponse)
{
	let newIUK = localSodium.randombytes_buf(32);
	let enscryptSalt = localSodium.randombytes_buf(16);
	let enscryptIter = 120;
	let enscryptLogN = 9;
	let newRescueCode = [];
	let additionalData = new Uint8Array(25);
	additionalData.set([73, 0, 2, 0], 0);
	additionalData.set(enscryptSalt, 4);
	additionalData.set([enscryptLogN, enscryptIter, 0, 0, 0], 20);//FIXME: only works when enscryptIter < 256
	for (let i = 0; i < 6; i++)
	{
		newRescueCode.push(zeropad(localSodium.randombytes_uniform(10000), 4));
	}
	enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(newRescueCode.join("")), enscryptSalt, enscryptLogN, enscryptIter, (step, max) => {
		chrome.runtime.sendMessage({'action': 'createIdentity.enscryptUpdate', "step": step, "max": max});
	}).then(enscryptedNewRescueCode => {
		if (enscryptedNewRescueCode.length === 32)
		{
			aesGcmEncrypt(newIUK, additionalData, enscryptedNewRescueCode, new Uint8Array(12)).then(dataToDecrypt => {
				memzero(newIUK);
				try {
					serializeBlock2(dataToDecrypt, additionalData).then(newTextualIdentity => {
						sendResponse({"success": true, "textualIdentity": newTextualIdentity, "rescueCode": newRescueCode.join("-"), "enscryptedRescueCode": JSON.stringify(Array.from(enscryptedNewRescueCode))});
					}).catch(err => {
						console.warn("background.createIdentity", "ERRCI005", "serializeBlock2 failed");
						sendResponse({"success": false, "errorCode": "ERRCI005"});
					});
				}
				catch (err)
				{
					console.warn("background.createIdentity", "ERRCI004", "serializeBlock2 failed");
					sendResponse({"success": false, "errorCode": "ERRCI004"});
				}
			}).catch(err => {
				console.warn("background.createIdentity", "ERRCI003", "aesGcmEncrypt failed");
				sendResponse({"success": false, "errorCode": "ERRCI003"});
			});
		}
		else
		{
			console.warn("background.createIdentity", "ERRCI002", "Length of enscryptedNewRescueCode should be 32");
			sendResponse({"success": false, "errorCode": "ERRCI002"});
		}
	}).catch(err => {
		console.warn("background.createIdentity", "ERRCI001", "enscrypt failed");
		sendResponse({"success": false, "errorCode": "ERRCI001"});
	});
}
function importIdentity(ti, rescueCode, enscryptedRescueCode, newPassword, sendResponse)
{
	if (rescueCode == null && enscryptedRescueCode == null)
	{
		console.warn("background.importIdentity", "ERRII006", "Missing rescueCode or enscryptedRescueCode");
		sendResponse({"success": false, "errorCode": "ERRII006"});
	}
	else
	{
		validateTextualIdentity(ti).then(validationResult => { //will also return success == true if the textual identity is only partly entered!
			if (validationResult.success)
			{
				try
				{
					let extractedBlock2 = parseBlockType2(ti);
					textualIdentity = ti;
					chrome.storage.local.set({"textualIdentity": ti});
					//console.log("rescueCode", JSON.stringify(Array.from(rescueCode)), rescueCode.length);
					let prms = enscryptedRescueCode == null ? enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(rescueCode.replace(/[^0-9]/g, "")), extractedBlock2.enscryptSalt, extractedBlock2.enscryptLogN, extractedBlock2.enscryptIter, (step, max) => {
						chrome.runtime.sendMessage({'action': 'importIdentity.enscryptUpdate', "step": step, "max": max}, result => {/* do nothing */});
					}) : new Promise(resolve => resolve(enscryptedRescueCode));
					prms.then(enscryptedRescueCodeLocal => {
						//console.log("enscryptedRescueCodeLocal", JSON.stringify(Array.from(enscryptedRescueCodeLocal)));
						aesGcmDecrypt(extractedBlock2.dataToDecrypt, extractedBlock2.additionalData, enscryptedRescueCodeLocal, new Uint8Array(12)).then(IUK => {
							let newIMK = enhash(IUK);
							memzero(IUK);
							let newPasswordAB = str2ab(newPassword);//FIXME: dont allow empty password
							setIMK(newIMK, newPasswordAB).then(result => {
								memzero(newIMK);
								//do not memzero newPasswordAB
								if (result && result.success)
								{
									sendResponse({"success": true});
								}
								else
								{
									console.warn("background.importIdentity", "ERRII007", "setIMK failed");
									sendResponse({"success": false, "errorCode": "ERRII007"});
								}
							}).catch(err => {
								memzero(newIMK);
								//do not memzero newPasswordAB
								console.warn("background.importIdentity", "ERRII006", "setIMK threw error", err);
								sendResponse({"success": false, "errorCode": "ERRII006"});
							});
						}).catch(err => {
							console.warn("background.importIdentity", "ERRII004", "aesGcmDecrypt IUK failed");
							sendResponse({"success": false, "errorCode": "ERRII004"});
						});
					}).catch(err => {
						console.warn("background.importIdentity", "ERRII003", "enscrypting rescueCode failed");
						sendResponse({"success": false, "errorCode": "ERRII003"});
					});
				}
				catch(err)
				{
					console.warn("background.importIdentity", "ERRII002");
					sendResponse({"success": false, "errorCode": "ERRII002"});
				}
			}
			else
			{
				console.warn("background.importIdentity", "ERRII001", "Invalid textualIdentity");
				sendResponse({"success": false, "errorCode": "ERRII001"});
			}
		}).catch(err => {
			console.warn("background.importIdentity", "ERRII000", "Validating textualIdentity failed");
			sendResponse({"success": false, "errorCode": "ERRII000"});
		});
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	/* for content.js */
	if (request.action === "getPostData")
	{
		if (sender != null && "tab" in sender && sender.tab.id != null)
		{
			if (hasIMK())
			{
				getPostDataQueue["" + sender.tab.id] = {"href": request.href, "windowLoc": request.windowLoc};
				showBadgeError("Auth", 6, sender.tab.id);
				sendResponse({"success": true});
			}
			else
			{
				showBadgeError("IDTY", 6, sender.tab.id);
				console.warn("background.requestAction", "ERRRA001", "Missing identity");
				sendResponse({"success": false, "errorCode": "ERRRA001"});
			}
/*
			let hasCalledSendresponse = getPostDataAsync(request.href, request.windowLoc, sendResponse, sender.tab.id);
			if (!hasCalledSendresponse)
				return true; // make asynchronous
*/
		}
		else
		{
			console.warn("background.requestAction", "ERRRA000", "Tab not found in sender");
			sendResponse({"success": false, "errorCode": "ERRRA000"});
		}
	}
	/* for popup.js */
	//FIXME: find a way to make sure these requests are not coming from content.js but from popup.js
	else if (request.action === "sendPostDataToActiveTab")
	{
		chrome.tabs.query({'active': true, 'currentWindow': true}, tabsResp => {
			if (tabsResp != null && tabsResp.length)
			{
				let tabId = tabsResp[0].id;
				if (tabId in getPostDataQueue)
				{
					try {
						showBadgeError("", 0, tabId);
						let origRequest = getPostDataQueue[tabId];
						if (tabsResp[0].url === origRequest.windowLoc)
						{
							let passwdAB = request.password == null ? null : str2ab(request.password); //is memzero'd by getPostDataAsync
							setSavepwd(request.savepwd);
							getPostDataAsync(origRequest.href, origRequest.windowLoc, passwdAB, data => {
								if (data.success)
								{
									delete getPostDataQueue[tabId];
									data.action = "getPostDataResp";
									chrome.tabs.sendMessage(tabId, data, resp => {
										//console.log("background.requestAction", "resp", resp);
									});
									sendResponse({"success": true, "hasOpenRequest": true}); // to popup
								}
								else
								{
									sendResponse(data); // to popup
								}
							}, tabId);
						}
						else
						{
							delete getPostDataQueue[tabId];
							//console.log("background.requestAction", "ERRRA003", "tab's location url has changed");
							sendResponse({"success": true, "hasOpenRequest": false});
						}
					} catch (err) {
						console.warn("background.requestAction", "ERRRA002");
						sendResponse({"success": false, "errorCode": "ERRRA002"});
					}
				}
				else
				{
					sendResponse({"success": true, "hasOpenRequest": false});
				}
			}
			else
			{
				sendResponse({"success": true, "hasOpenRequest": false});
			}
		});
		return true;
	}
	else if (request.action === "hasPendingRequest")
	{
		chrome.tabs.query({'active': true, 'currentWindow': true}, tabsResp => {
			if (chrome.runtime.lastError)
			{
				console.warn("background.requestAction", "ERRRA003");
				sendResponse({"success": false, "hasPendingRequest": false, "errorCode": "ERRRA003"});
			}
			else if (tabsResp != null && tabsResp.length)
			{
				let tabId = tabsResp[0].id;
				sendResponse({"success": true, "hasPendingRequest": tabId in getPostDataQueue});
			}
		});
		return true;
	}
	else if (request.action === "hasPassword")
	{
		sendResponse({"hasPassword": hasPassword()});
	}
	else if (request.action === "isSavepwd")
	{
		sendResponse({"isSavepwd": savepwd});
	}
	else if (request.action === "hasIdentity")
	{
		if (hasIMK())
			sendResponse({"hasIdentity": true, "isSavepwd": savepwd, "textualIdentity": textualIdentity});
		else
			sendResponse({"hasIdentity": false, "isSavepwd": false, "partialTextualIdentity": partialTextualIdentity});
	}
	else if (request.action === "eraseIdentity")
	{
console.log(1);
		erasePasswordEnscrypted();
console.log(2);
		eraseIMK();
		chrome.storage.local.remove(["identityDataType2"], () => {
			sendResponse(chrome.runtime.lastError);
		});
		return true;
	}
	else if (request.action === "createIdentity")
	{
		createIdentity(sendResponse);
		return true;
	}
	else if (request.action === "importIdentity")
	{
		let enscryptedRescueCodeLocal = null;
		if ("enscryptedRescueCode" in request)
		{
			enscryptedRescueCodeLocal = new Uint8Array(request.enscryptedRescueCode);
			memzero(request.enscryptedRescueCode);
		}
		importIdentity(request.textualIdentity, request.rescueCode, enscryptedRescueCodeLocal, request.password, sendResponse);
		partialTextualIdentity = null;
		return true;
	}
	else if (request.action === "importPartialIdentity")
	{
		partialTextualIdentity = request.textualIdentity;
	}
	else
		console.warn("background", "request action not recognised", request.action);
});

chrome.storage.local.get(["textualIdentity"], function(result){
	if (result.textualIdentity)
	{
		textualIdentity = result.textualIdentity;
	}
});















//------------------------------- Utils -------------------------------//
function showBadgeError(txt, animateCount, tabId)//animateCount must be even
{
	chrome.browserAction.setBadgeBackgroundColor({color: "red"});
	chrome.browserAction.setBadgeText({"text": animateCount % 2 ? "" : txt, "tabId": tabId});
	if (animateCount > 0)
	{
		setTimeout(function(){ showBadgeError(txt, animateCount - 1, tabId); }, 300);
	}
}
function zeropad(nmbr, len)
{
	if (typeof nmbr == "number")
		nmbr = "" + nmbr;
	if (typeof nmbr != "string")
		throw new Error('Arument 1 "nmbr" should be a string or a number');
	if (typeof len != "number")
		throw new Error('Arument 2 "len" should be a number');
	if (len < 0)
		throw new Error('Arument 2 "len" should be positive');
	if (len < nmbr.length)
		throw new Error('Arument 2 "len" should be greater than the length of argument 1 "nmbr"');
	return new Array(len + 1 - nmbr.length).join("0") + nmbr;
}
function memzero(e)
{
	if (e.constructor === Uint8Array)
		for (let i = 0; i < e.length; i++)
			e[i] = 0;
	else if (e.constructor === BN)
		for (let i = 0; i < e.words.length; i++)
			e.words[i] = 0;
	else if (Array.isArray(e)) //TODO: check that setting the values to null is better than setting them to 0
		for (let i = 0; i < e.length; i++)
			e[i] = 0;
	else
		throw new Error("Only Uint8Array, Array and BN instances can be wiped");
}
function str2ab(str) //WARNING: nameclash with the same method in utils.js //string to arraybuffer (Uint8Array)
{
	return new TextEncoder("utf-8").encode(str);
}
function ab2int(ab) //arraybuffer (Uint8Array) to int. Only works up to Number.MAX_SAFE_INTEGER or ab.length == 6
{
	if (ab.constructor !== Uint8Array)
		throw new Error("First argument \"ab\" should be a Uint8Array");
	if (ab.length > 6)
		throw new Error("Max length of Uint8Array is 6");
	let result = 0;
	let fact = 1;
	for (let i of ab)
	{
		result += fact * i;
		fact *= 256;
	}
	fact = 0; //cleanup
	return result;
}
function ab2hex(ab) //arraybuffer (Uint8Array) to hex
{
	let ui8a = null;
	if (ab.constructor === ArrayBuffer)
		ui8a = new Uint8Array(ab);
	else if (ab.constructor === Uint8Array)
		ui8a = ab;
	else
		throw new Error("First argument \"ab\" should be an Uint8Array or an ArrayBuffer");
	let result = [];
	for (let i of ui8a)
	{
		result.push(('00'+i.toString(16)).slice(-2));
	}
	if (ab.constructor === ArrayBuffer)
		memzero(ui8a);
	return result.join('');
}
function ar2hex(ar) //array of integers to hex
{
	return ar.map(i => ('00'+i.toString(16)).slice(-2)).join('');
}
function ui8aXOR(a, b) //beware: result is written back into a
{
	for (let i = 0; i < a.length; i++)
	{
		a[i] = a[i] ^ b[i];
	}
}
async function sleep(ms)
{
	return new Promise(resolve => setTimeout(resolve, ms));
}

//uses https://github.com/tonyg/js-scrypt/ or sodium
async function enscrypt(scrypt, pwd, salt, logN, iterations, callback)
{
//console.log("enscrypt", pwd, salt, logN, iterations);
	if (typeof callback != "function")
		callback = function(){};
	let N = Math.pow(2, logN);
	let result = scrypt(pwd, salt, N, 256, 1, 32);
	let xorresult = new Uint8Array(result);
	for (let i = 1; i < iterations; i++)
	{
		callback(i, iterations);
		await sleep(1); //sleep 1ms to allow UI update
		result = scrypt(pwd, result, N, 256, 1, 32);
		ui8aXOR(xorresult, result);//result of XOR is written back into xorresult
	}
	memzero(result);
	callback(iterations, iterations);
	return xorresult;
}
function enhash(input)
{
	if (input.constructor === Uint8Array && input.length === 32)
	{
		let output = new Uint8Array(32);
		for (let i = 0; i < 16; i++)
		{
			input = localSodium.crypto_hash_sha256(input);
			ui8aXOR(output, input);//result of XOR is written back into output
		}
		memzero(input);
		return output;
	}
	else
		throw new Error('Argument 1 "input" should be a Uint8Array of length 32');
}

async function aesGcmEncrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(true, data, additionalData, password, iv);
}
async function aesGcmDecrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(false, data, additionalData, password, iv);
}
async function aesGcmCrypt(isEncrypt, data, additionalData, password, iv)
{
	if (data.constructor === Uint8Array && data.length > 0)
	{
		if (additionalData == null || (additionalData.constructor === Uint8Array && additionalData.length > 0))
		{
			if (password.constructor === Uint8Array && password.length === 32)
			{
				if (iv.constructor === Uint8Array && iv.length === 12)
				{
					let cData = { "name": "AES-GCM", "iv": iv };//, "tagLength": 128 };
					if (additionalData != null)
					{
						cData.additionalData = additionalData;
					}
					if (isEncrypt)
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["encrypt"]).then(key => crypto.subtle.encrypt(cData, key, data)).then(encr => new Uint8Array(encr));
					}
					else
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["decrypt"]).then(key => crypto.subtle.decrypt(cData, key, data)).then(decr => new Uint8Array(decr));
					}
				}
				else
					return Promise.reject('Argument 4 "iv" should be a Uint8Array of length 12');
			}
			else
				return Promise.reject('Argument 3 "password" should be a Uint8Array of length 32');
		}
		else
			return Promise.reject('Argument 2 "additionalData" should be a non-empty Uint8Array or null');
	}
	else
		return Promise.reject('Argument 1 "data" should be a non-empty Uint8Array');
}

async function validateTextualIdentity(ti)
{
	let lines = ti.split(/\r?\n/);
	let base56invalidsCharsRe = new RegExp(`([^${base56chars}])`);
	for (let [lIndex, line] of lines.entries())
	{
		let blocks = line.split(/ /);
		if (blocks.length < 5 && lIndex < lines.length - 1)
			return { "success": false, "lineNr": lIndex, "message": `Not enough blocks on line ${lIndex + 1}.\nA line must contain 5 blocks (of 4 characters), separated by spaces, unless it is the last line.` };
		if (blocks.length > 5)
			return { "success": false, "lineNr": lIndex, "message": `Too many blocks on line ${lIndex + 1}.\nA line can contain a maximum of 5 blocks (of 4 characters), separated by spaces.` };
		for (let [bIndex, block] of blocks.entries())
		{
			if (block.length < 4 && (bIndex < blocks.length - 1 || lIndex < lines.length - 1))
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Not enough characters in block ${bIndex + 1} on line ${lIndex + 1}.\nA block must contain 4 characters unless it is the last block in the last line.` };
			if (block.length > 4)
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Too many characters in block ${bIndex + 1} on line ${lIndex + 1}.\nA block can contain a maximum of 4 characters.` };
			let b56mismatch = block.match(base56invalidsCharsRe);
			if (b56mismatch)
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Invalid character "${b56mismatch[1]}" on line ${lIndex + 1}.\nA block can only contain valid base56 characters.` };
		}
		//The final character on each line is a line checksum character formed by taking the (SHA256 mod 56) hashing of the line's previous characters plus the 0-based line number.
		if (line.length == 24 || (lIndex == 5 && line.length == 8) || (lIndex == 9 && line.length == 6)) //FIXME: add check for 2 or 3 prev identities
		{
			let lineChars = blocks.join("");
			let lastChar = lineChars.slice(-1);
			if (lastChar !== await getVerificationChar(lineChars, lIndex))
				return { "success": false, "lineNr": lIndex, "message": `Verification character mismatch on line ${lIndex + 1}.\nOne or more of the characters on this line is wrong.` };
		}
	}
	return { "success": true, "lineNr": lines.length };
}
function parseBlockType2(ti)
{
	let identityData = base56decode(ti.replace(/[\t ]/g,'').replace(/.(\r?\n|$)/g, "")).toArrayLike(Uint8Array).reverse();
	if ([73, 127, 159, 191, 223].indexOf(identityData.length) > -1)
	{
		//console.log("identityData", JSON.stringify(Array.from(identityData)), identityData.length);
		let blockSize = ab2int(identityData.slice(0, 2));
		let blockType = ab2int(identityData.slice(2, 4));
		if (blockType == 2 && blockSize == 73)
		{
			let data = identityData.slice(0, blockSize);
			return {
				"enscryptSalt": data.slice(4, 20),
				"enscryptLogN": ab2int(data.slice(20, 21)),
				"enscryptIter": ab2int(data.slice(21, 25)),
				"dataToDecrypt": data.slice(25, 73),
				"additionalData": data.slice(0, 25)
			};
		}
		else
			throw new Error('Argument 1 "ti" should start with a type2 data block of length 73');
	}
	else
		throw new Error('base56decoded length of first argument "ti" should be 73, 127, 159, 191 or 223');
}
async function serializeBlock2(dataToDecrypt, additionalData)
{
	let data = new Uint8Array(73);
	if (dataToDecrypt.constructor === Uint8Array && dataToDecrypt.length === 48)
	{
		if (additionalData.constructor === Uint8Array && additionalData.length === 25)
		{
			data.set(additionalData, 0);
			data.set(dataToDecrypt, 25);
			data.reverse();
			let ti = base56encode(data);
			let promises = [];
			for (let i = 0; 19 * i < ti.length; i++)
			{
				promises.push(getVerificationChar(ti.substr(19 * i, 19) + " ", i));
			}
			return Promise.all(promises).then(verificationChars => {
				let result = [];
				for (let i = 0; 19 * i < ti.length; i++)
				{
					result[i] = (ti.substr(19 * i, 19) + verificationChars[i]).replace(/(.{4})\B/g, "$1 ");
				}
				return result.join("\n");
			});
		}
		else
			return Promise.reject('Argument 2 "additionalData" should be a Uint8Array of length 25');
	}
	else
		return Promise.reject('Argument 1 "dataToDecrypt" should be a Uint8Array of length 48');
}


function base64url_encode(str)
{
	return localSodium.to_base64(localSodium.from_string(str), localSodium.base64_variants.URLSAFE_NO_PADDING);
}
//uses BigNum, https://github.com/indutny/bn.js/
function base56encode(i)
{
	let bi;
	if (i.constructor === BN)
		bi = i;
	else if (typeof i == "string" || i.constructor === Uint8Array)
		bi = new BN(i);
	else if (typeof i == "number")
	{
		if (i > Number.MAX_SAFE_INTEGER)
			throw new Error('base56encode: ERROR. Argument 1 "i" larger than ' + Number.MAX_SAFE_INTEGER + ' should be represented as String or BigInt');
		bi = new BN(i);
	}
	else
		throw new Error('base56encode: ERROR. Argument 1 "i" should be an integer represented as String, BigInt or Number');
	if (bi.isNeg())
		throw new Error('base56encode: ERROR. Argument 1 "i" should be positive');
	let result = [];
	do
	{
		let r = bi.modn(56);
		let q = bi.divn(56);
		result.push(base56chars[r]);
		bi = q;
	}
	while (bi.gtn(0));
	return result.join('');
}
function base56decode(s)
{
	if (typeof s != "string")
		throw new Error('base56decode: ERROR. Argument 1 "s" should be a String');
	if (/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]/.test(s))
		throw new Error('base56decode: ERROR. Argument 1 "s" can only contain valid base56 characters [23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]');
	if (s == null || s == "")
		return 0;
	let result = new BN(0);
	for (let i = s.length-1; i >= 0; i--)
	{
		result.imuln(56);
		result.iaddn(base56chars.indexOf(s.charAt(i)));
	}
	return result;
}
function isValidHostname(hn) // Must be punycode-encoded, like `new URL().hostname` is;
{
	/*
Hostnames are composed of series of labels concatenated with dots, as are all domain names.
For example, "en.wikipedia.org" is a hostname. Each label must be between 1 and 63 characters long, and the entire hostname has a maximum of 255 characters.
RFCs mandate that a hostname's labels may contain only the ASCII letters 'a' through 'z' (case-insensitive), the digits '0' through '9', and the hyphen. Hostname labels cannot begin or end with a hyphen. No other symbols, punctuation characters, or blank spaces are permitted.
	*/
	if (hn == null || typeof hn != "string" || hn.length == 0 || hn.length > 255 || !/^[a-zA-Z0-9\.\-]+$/.test(hn))
		return false;
	let splt = hn.split(".");
	for (let lbl of splt)
		if (lbl.length < 1 || lbl.length > 63 || lbl.startsWith('-') || lbl.endsWith('-'))
			return false;
	return true;
}
}
