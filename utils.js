"use strict";
const base56chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

function memzero(e) //WARNING: nameclash with the same method in background.js
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
function str2ab(str)
{
	return new TextEncoder("utf-8").encode(str);
}
function ab2str(ab)
{
	return new TextDecoder("utf-8").decode(ab);
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


async function validateTextualIdentity(ti)
{
	ti = ti.replace(/[\s\xA0]+$/, '');//trim trailing whitespace
	let lines = ti.split(/\r?\n/);
	let base56invalidsCharsRe = new RegExp(`([^${base56chars}])`);
	for (let [lIndex, line] of lines.entries())
	{
		if (/^\s+/.test(line))
			return { "success": false, "lineNr": lIndex, "message": `Leading whitespace on line ${lIndex + 1}.\nRemove any leading spaces or tabs` };
		let blocks = line.split(/ /);
		if ((lIndex < lines.length - 1 || blocks.length > 5) && /\s+$/.test(line))
			return { "success": false, "lineNr": lIndex, "message": `Trailing whitespace on line ${lIndex + 1}.\nRemove any trailing spaces or tabs` };
		if (blocks.length < 5 && lIndex < lines.length - 1)
			return { "success": false, "lineNr": lIndex, "message": `Not enough blocks on line ${lIndex + 1}.\nA line must contain 5 blocks (of 4 characters), separated by spaces, unless it is the last line.` };
		if (blocks.length > 5)
			return { "success": false, "lineNr": lIndex, "message": `Too many blocks on line ${lIndex + 1}.\nA line can contain a maximum of 5 blocks (of 4 characters), separated by spaces and terminated by a newline.` };
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
	return { "success": true, "lineNr": lines.length, "trimmedTextualInput": ti };
}
function parseTextualIdentity(ti)
{
	let identityData = base56decode(ti.replace(/[\t ]/g,'').replace(/.(\r?\n|$)/g, "")).toArrayLike(Uint8Array).reverse();
	if ([73, 127, 159, 191, 223].indexOf(identityData.length) > -1)
	{
		//console.log("identityData", JSON.stringify(Array.from(identityData)), identityData.length);
		let blockSize = ab2int(identityData.slice(0, 2));
		let blockType = ab2int(identityData.slice(2, 4));
		if (blockType == 2) //The TI should start with a block of type 2 and may also have a block of type 3
		{
			if (blockSize == 73)
			{
				return identityData;
			}
			else
				throw new Error('Argument 1 "ti" should start with a data block of length 73');
		}
		else
			throw new Error('Argument 1 "ti" should start with a type2 data block');
	}
	else
		throw new Error('base56decoded length of first argument "ti" should be 73, 127, 159, 191 or 223');
}


async function getVerificationChar(lineChars, lineIndex)
{
	let lineCharInts = str2ab(lineChars);
	lineCharInts[lineCharInts.length - 1] = lineIndex;
	let sha256 = new Uint8Array(await crypto.subtle.digest('SHA-256', lineCharInts)).reverse();
	let sha256bn = new BN(sha256);
	let verificationInt = sha256bn.modn(56);
//console.log("getVerificationChar", lineChars, lineIndex, base56chars[verificationInt]);
	return base56chars[verificationInt];
}
function showGenericError(src, code, txt)
{
	//FIXME
	alert(src + "\n" + code + "\n" + txt);
}
function showPasswordError(input)
{
	input.classList.add("shake");
	input.setCustomValidity("Incorrect password");
	setTimeout(() => { input.classList.remove("shake"); input.setCustomValidity("");  }, 500);
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
async function addVerificationAndWhitespaceToTextualIdentity(ti)
{
	let result = [];
	for (let i = 0; 19 * i < ti.length; i++)
	{
		let verificationChar = await getVerificationChar(ti.substr(19 * i, 19) + " ", i);
		result[i] = (ti.substr(19 * i, 19) + verificationChar).replace(/(.{4})\B/g, "$1 ");
	}
	return result.join("\n");
}
function getBrowser()
{
	if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0)
		return "opera";
	if (typeof InstallTrigger !== 'undefined')
		return "firefox";
	if (!!document.documentMode && !!window.StyleMedia)
		return "edge";
	return "chrome";
}
function makeQR(img, data)
{
	let dotsize = 10;  // size of box drawn on canvas
	let canvas = document.createElement('canvas');
	let qrCanvasContext = canvas.getContext('2d');
	let qr = qrcodegen.QrCode.encodeBinary(data, qrcodegen.QrCode.Ecc.LOW);

	let width = qr.size * dotsize + 10;
	canvas.setAttribute('height', width);
	canvas.setAttribute('width', width);
	qrCanvasContext.fillStyle = "#FFF";
	qrCanvasContext.fillRect(0, 0, width, width);
	for (let x = 0; x < qr.size; x++) {
		for (let y = 0; y < qr.size; y++) {
			qrCanvasContext.fillStyle = qr.getModule(x, y) ? "#000" : "#FFF";
			qrCanvasContext.fillRect(x*dotsize + 5,y*dotsize + 5, dotsize, dotsize);   // x, y, w, h
		}
	}
	img.src = canvas.toDataURL("image/png");
	img.style.width = width/2 + "px";
}
function isValidURLPath(path)
{
	if (!path.startsWith("/"))
		return false;
	let origin = "https://a.com";
	let url = new URL(origin + path);
	if (url.origin == origin)
		return true;
	return false;
}
function insertStringBeforeCaret(input, val)
{
	input.setRangeText(val, input.selectionStart, input.selectionEnd, "end");
}
