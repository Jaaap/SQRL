"use strict";
const base56chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

//uses https://raw.githubusercontent.com/peterolson/BigInteger.js/master/BigInteger.js
function base56encode(i)
{
	let bi;
	if (i instanceof bigInt)
		bi = i;
	else if (typeof i == "string")
		bi = bigInt(i);
	else if (typeof i == "number")
	{
		if (i > Number.MAX_SAFE_INTEGER)
			throw 'base56encode: ERROR. Argument 1 "i" larger than ' + Number.MAX_SAFE_INTEGER + ' should be represented as String or BigInt';
		bi = bigInt(i);
	}
	else
		throw 'base56encode: ERROR. Argument 1 "i" should be an integer represented as String, BigInt or Number';
	if (bi.lesser(0))
		throw 'base56encode: ERROR. Argument 1 "i" should be positive';
	let result = [];
	do
	{
		let { quotient: q, remainder: r } = bi.divmod(56);
		result.unshift(base56chars[r.toJSNumber()]);
		bi = q;
	}
	while (bi.greater(0));
	return result.join('');
}
function base56decode(s)
{
	if (typeof s != "string")
		throw 'base56decode: ERROR. Argument 1 "s" should be a String';
	if (/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]/.test(s))
		throw 'base56decode: ERROR. Argument 1 "s" can only contain valid base56 characters [23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]';
	if (s == null || s == "")
		return 0;
	let result = bigInt(0);
	let factor = bigInt(1);
	for (let c of s.split('').reverse())
	{
		result = result.add(factor.multiply(base56chars.indexOf(c)));
		factor = factor.multiply(56);
	}
	return result;
}
