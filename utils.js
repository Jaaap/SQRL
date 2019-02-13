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

async function validateTextualIdentity(ti)
{
	let lines = ti.split(/\r?\n/);
	if (/\s+$/.test(ti))
		return { "success": false, "lineNr": lines.length - 1, "message": `Trailing whitespace on last line.\nRemove any trailing newlines or spaces or tabs` };
	let base56invalidsCharsRe = new RegExp(`([^${base56chars}])`);
	for (let [lIndex, line] of lines.entries())
	{
		if (/^\s+/.test(line))
			return { "success": false, "lineNr": lIndex, "message": `Leading whitespace on line ${lIndex + 1}.\nRemove any leading newlines or spaces or tabs` };
		if (/\s+$/.test(line))
			return { "success": false, "lineNr": lIndex, "message": `Trailing whitespace on line ${lIndex + 1}.\nRemove any trailing newlines or spaces or tabs` };
		let blocks = line.split(/ /);
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
	return { "success": true, "lineNr": lines.length };
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
