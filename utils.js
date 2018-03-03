"use strict";
const base56chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

function str2ab(str) //WARNING: nameclash with the same method in background.js //string to arraybuffer (Uint8Array)
{
	return new TextEncoder("utf-8").encode(str);
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

