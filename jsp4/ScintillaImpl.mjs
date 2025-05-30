'use strict'

const filenames = {
	'input': new URL('../scintilla/include/Scintilla.iface', import.meta.url),
	'template': new URL('./ScintillaImpl.template.hpp', import.meta.url),
	'output': new URL('./ScintillaImpl.hpp', import.meta.url),
}

const typeAliases = {
	'cells': 'const char*',
	'colour': 'Colour',
	'colouralpha': 'ColourAlpha',
	'findtext': 'void*',
	'findtextfull': 'TextToFindFull*',
	'formatrange': 'void*',
	'formatrangefull': 'RangeToFormatFull*',
	'keymod': 'int',
	'line': 'Line',
	'pointer': 'void*',
	'position': 'Position',
	'string': 'const char*',
	'stringresult': 'char*',
	'textrange': 'void*',
	'textrangefull': 'TextRangeFull*',
}

const basicTypes = [
	"bool",
	"char*",
	"Colour",
	"ColourAlpha",
	"const char*",
	"int",
	"intptr_t",
	"Line",
	"Position",
	"void",
	"void*",
]

function format(name, type, ptr) {
	if (!name.length)
		return '0'

	if (type.endsWith('*'))
		return `reinterpret_cast<${ptr}>(${name})`

	if (!basicTypes.includes(type))
		return `static_cast<${ptr}>(${name})`

	return name
}

function get_args(line) {
	const start = line.indexOf('(')
	const end = line.indexOf(')')
	return line.substr(start + 1, end - start - 1).split(',').map(item => item.trim().split(' '))
}

function get_type(type) {
	if (!type)
		return ''

	return typeAliases[type] || type
}

function build_call(name, typeWp, nameWp, typeLp, nameLp, ret) {
	let call;

	if (typeLp == 'const char*')
		call = `CallString(Message::${name}, ${format(nameWp, typeWp, 'uintptr_t')}, ${nameLp})`
	else if (typeLp.endsWith('*'))
		call = `CallPointer(Message::${name}, ${format(nameWp, typeWp, 'uintptr_t')}, ${nameLp})`
	else if (typeLp.length)
		call = `Call(Message::${name}, ${format(nameWp, typeWp, 'uintptr_t')}, ${format(nameLp, typeLp, 'intptr_t')})`
	else if (typeWp.length)
		call = `Call(Message::${name}, ${format(nameWp, typeWp, 'uintptr_t')})`
	else
		call = `Call(Message::${name})`

	if (ret == 'void*')
		return `return reinterpret_cast<void*>(${call});`
	else if (!basicTypes.includes(ret) || ret == 'int' || ret == 'Colour' || ret == 'ColourAlpha')
		return `return static_cast<${ret}>(${call});`
	else if (ret != 'void')
		return `return ${call};`
	else
		return `${call};`
}

function create_body(content) {
	const CRLF = '\r\n'
	const lines = content.split(CRLF)
	const features = ['fun', 'get', 'set']
	let tmp = []

	for (const line of lines) {
		if (line.startsWith('cat Deprecated'))
			break

		const arr = line.substr(0, line.indexOf('=')).split(' ')
		const feature = arr[0]

		if (features.includes(feature)) {
			const ret = get_type(arr[1])
			const name = arr[2]

			const [wp, lp] = get_args(line)
			const typeWp = get_type(wp[0])
			const nameWp = wp[1] || ''
			const typeLp = get_type(lp[0])
			const nameLp = lp[1] || ''
			let str = `\t${ret} ${name}(`

			if (typeWp.length)
				str += `${typeWp} ${nameWp}`

			if (typeWp.length && typeLp.length)
				str += ', '

			if (typeLp.length)
				str += `${typeLp} ${nameLp}`

			const call = build_call(name, typeWp, nameWp, typeLp, nameLp, ret)
			str += `) { ${call} }`
			tmp.push(str)
		}
	}

	tmp.sort()
	return tmp.join(CRLF)
}

import { readFile, writeFile } from 'fs/promises'

const options = 'utf8'
const input = await readFile(filenames.input, options)
const template = await readFile(filenames.template, options)
const body = create_body(input)
const output = template.replace('REPLACEME', body)
await writeFile(filenames.output, output, options)
console.log('Done!')
