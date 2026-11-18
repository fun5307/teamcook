#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync, watch, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import { createInterface } from "node:readline";
import * as zlib from "node:zlib";
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
// src/data/collaboration.ts
var COLLABORATIONS$1 = {
	subagents: {
		id: "subagents",
		label: "서브에이전트",
		chip: "서브에이전트",
		description: "메인 AI가 일을 나눠 서브에이전트에게 맡기고, 결과를 돌려받습니다. 서브에이전트끼리 직접 소통할 수 있는지는 도구마다 다르고, 이 사이트는 그것을 설정하지 않아요. 가장 무난한 방식입니다.",
		availability: "Codex, Claude Code 등 카드마다 고른 도구에서",
		experimental: false,
		notes: []
	},
	"agent-team": {
		id: "agent-team",
		label: "에이전트 팀",
		chip: "에이전트 팀",
		description: "Claude Code가 리더가 되어 팀원을 여럿 띄웁니다. 팀원끼리 직접 대화하고 할 일 목록을 함께 쓰기 때문에, 서로 의견을 주고받아야 하는 일에 맞아요.",
		availability: "Claude Code에서만 (실험 기능)",
		experimental: true,
		notes: [
			"에이전트 팀은 Claude Code의 실험 기능이에요. 기본으로 꺼져 있어서 설정 파일로 켜야 하고, 동작이 바뀔 수 있어요.",
			"팀원 수만큼 사용량이 늘어요. 공식 문서는 3~5명으로 시작하라고 권합니다.",
			"리더는 처음 연 Claude Code 대화창으로 고정돼요. 팀원이 또 팀을 만들 수는 없어요.",
			"대화를 이어서 열면(/resume) 팀원은 되살아나지 않아요. 리더에게 팀원을 다시 만들라고 하세요.",
			"팀원이 일을 끝내고도 \"완료\" 표시를 빠뜨릴 때가 있어요. 멈춘 것 같으면 리더에게 확인을 부탁하세요."
		],
		sourceUrl: "https://code.claude.com/docs/en/agent-teams",
		lastVerified: "2026-11-16"
	},
	debate: {
		id: "debate",
		label: "토론형",
		chip: "토론형",
		description: "설정 파일 없이 프롬프트 하나로 돌립니다. 한 AI가 여러 역할을 번갈아 맡아 토론하고 결론을 냅니다. 별도 세션끼리 주고받는 협업과는 다릅니다. 역할은 프롬프트 안에 들어가고, 무료 웹 채팅을 포함해 어느 AI에서나 붙여 넣으면 돼요.",
		availability: "어느 AI에서나 (무료 웹 채팅 포함)",
		experimental: false,
		notes: ["한 AI가 여러 역할을 연기하는 방식이라, 서로 다른 모델이 검토하는 것만큼 독립적이지는 않아요. 중요한 결정은 다른 AI에도 같은 프롬프트를 넣어 비교해 보세요."]
	}
};
Object.keys(COLLABORATIONS$1);
/** 레시피의 조리법. 없거나 모르는 값이면 'subagents'. */
function collaborationOf(recipe) {
	const value = recipe.collaboration;
	return value && value in COLLABORATIONS$1 ? value : "subagents";
}
/**
* 에이전트 팀을 켜는 프로젝트용 설정 (`.claude/settings.json`).
* 2026-11-16 확인: https://code.claude.com/docs/en/agent-teams
* 사용자의 `~/.claude/settings.json`은 건드리지 않는다. 프로젝트 폴더용 파일만 내보낸다.
*/
var AGENT_TEAMS_ENV_NAME = "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS";
var AGENT_TEAMS_SETTINGS_JSON = `${JSON.stringify({ env: { [AGENT_TEAMS_ENV_NAME]: "1" } }, null, 2)}\n`;
/** 이미 `.claude/settings.json`이 있는 사람에게 보여 줄 병합 안내 */
var AGENT_TEAMS_MERGE_HINT = `이미 .claude/settings.json이 있다면 덮어쓰지 말고, 그 파일의 "env" 안에 "${AGENT_TEAMS_ENV_NAME}": "1" 한 줄만 더하세요.`;
// src/data/providers.ts
var providerData = {
	schemaVersion: 1,
	lastVerified: "2026-11-16",
	providers: {
		"openai": {
			"name": "OpenAI",
			"productName": "ChatGPT",
			"plans": [
				{
					"id": "none",
					"label": "안 써요",
					"paid": false
				},
				{
					"id": "free",
					"label": "Free (무료)",
					"paid": false,
					"price": "$0"
				},
				{
					"id": "go",
					"label": "Go",
					"paid": true,
					"price": "$8/월"
				},
				{
					"id": "plus",
					"label": "Plus",
					"paid": true,
					"price": "$20/월"
				},
				{
					"id": "pro",
					"label": "Pro",
					"paid": true,
					"price": "$100/월부터"
				}
			],
			"apiNote": "OpenAI API 키가 있으면 플랜과 상관없이 Codex CLI를 쓸 수 있어요. 쓴 만큼 요금이 나가요.",
			"sourceUrl": "https://learn.chatgpt.com/docs/pricing",
			"lastVerified": "2026-11-16"
		},
		"anthropic": {
			"name": "Anthropic",
			"productName": "Claude",
			"plans": [
				{
					"id": "none",
					"label": "안 써요",
					"paid": false
				},
				{
					"id": "free",
					"label": "Free (무료)",
					"paid": false
				},
				{
					"id": "pro",
					"label": "Pro",
					"paid": true
				},
				{
					"id": "max",
					"label": "Max",
					"paid": true
				},
				{
					"id": "ultra",
					"label": "Ultra",
					"paid": true
				}
			],
			"apiNote": "Claude 콘솔(API) 계정이 있으면 구독 없이 Claude Code를 쓸 수 있어요. 쓴 만큼 요금이 나가요.",
			"sourceUrl": "https://code.claude.com/docs/en/setup",
			"lastVerified": "2026-11-16"
		},
		"google": {
			"name": "Google",
			"productName": "Gemini",
			"plans": [
				{
					"id": "none",
					"label": "안 써요",
					"paid": false
				},
				{
					"id": "free",
					"label": "무료",
					"paid": false
				},
				{
					"id": "paid",
					"label": "유료 (Google AI Pro·Ultra)",
					"paid": true
				}
			],
			"apiNote": "Gemini API 키(Google AI Studio)는 무료 한도가 있다고 알려져 있어요. (공식 문서 미확인)",
			"sourceUrl": "https://www.tembo.io/blog/gemini-cli-pricing",
			"lastVerified": "2026-11-16"
		},
		"xai": {
			"name": "xAI",
			"productName": "Grok",
			"plans": [
				{
					"id": "none",
					"label": "안 써요",
					"paid": false
				},
				{
					"id": "free",
					"label": "무료",
					"paid": false
				},
				{
					"id": "supergrok",
					"label": "SuperGrok / X Premium+",
					"paid": true
				}
			],
			"apiNote": "xAI API 키로도 Grok Build를 쓸 수 있다고 알려져 있어요. (공식 문서 미확인)",
			"sourceUrl": "https://amplifying.ai/coding-agents/grok-build",
			"lastVerified": "2026-11-16"
		}
	},
	engines: {
		"codex-cli": {
			"name": "Codex",
			"provider": "openai",
			"status": "ready",
			"configFormat": ".codex/agents/*.toml",
			"access": [
				{
					"path": 1,
					"plans": ["plus", "pro"],
					"label": "ChatGPT Plus·Pro 로그인",
					"badge": "ChatGPT Plus 필요",
					"notes": []
				},
				{
					"path": 2,
					"apiKey": true,
					"label": "OpenAI API 키 (종량제)",
					"notes": ["쓴 만큼 요금이 나가요."]
				},
				{
					"path": 3,
					"plans": ["free", "go"],
					"label": "ChatGPT 데스크톱 앱의 Codex (Free·Go 한도)",
					"badge": "ChatGPT 무료",
					"free": true,
					"notes": ["Free·Go 플랜은 터미널(CLI)이 아니라 ChatGPT 데스크톱 앱에서만 Codex를 쓸 수 있어요.", "한도가 작고, 계정에 따라 아직 열리지 않았을 수 있어요 (순차 제공 중)."]
				}
			],
			"lockReason": "Codex를 쓰려면 ChatGPT 계정(무료도 가능)이나 OpenAI API 키가 필요해요",
			"confidence": "official",
			"sourceUrl": "https://learn.chatgpt.com/docs/pricing",
			"lastVerified": "2026-11-16",
			"configSourceUrl": "https://learn.chatgpt.com/docs/agent-configuration/subagents"
		},
		"claude-code": {
			"name": "Claude Code",
			"provider": "anthropic",
			"status": "ready",
			"configFormat": ".claude/agents/*.md",
			"access": [{
				"path": 1,
				"plans": [
					"pro",
					"max",
					"ultra"
				],
				"label": "Claude Pro·Max·Ultra 로그인",
				"badge": "Claude Pro 필요",
				"notes": []
			}, {
				"path": 2,
				"apiKey": true,
				"label": "Claude 콘솔 API 키 (종량제)",
				"notes": ["쓴 만큼 요금이 나가요."]
			}],
			"lockReason": "Claude Code는 Pro 이상에서만 쓸 수 있어요 (Free 플랜 불가)",
			"confidence": "official",
			"sourceUrl": "https://code.claude.com/docs/en/setup",
			"lastVerified": "2026-11-16",
			"configSourceUrl": "https://code.claude.com/docs/en/sub-agents"
		},
		"antigravity-cli": {
			"name": "Antigravity CLI",
			"provider": "google",
			"status": "ready",
			"access": [{
				"path": 1,
				"plans": ["paid"],
				"label": "Google AI Pro·Ultra 로그인",
				"badge": "Google AI Pro 필요",
				"notes": []
			}, {
				"path": 3,
				"plans": ["free"],
				"label": "Antigravity 무료 개인 플랜",
				"badge": "Google 무료",
				"free": true,
				"notes": ["무료 한도는 작고 예고 없이 바뀔 수 있어요. (공식 문서 미확인)"]
			}],
			"lockReason": "Antigravity CLI를 쓰려면 Google 계정이 필요해요",
			"confidence": "third-party",
			"sourceUrl": "https://www.tembo.io/blog/gemini-cli-pricing",
			"lastVerified": "2026-11-16",
			"configFormat": ".agents/agents/*.md",
			"configSourceUrl": "https://antigravity.google/docs/subagents"
		},
		"grok-build": {
			"name": "Grok Build",
			"provider": "xai",
			"status": "ready",
			"access": [{
				"path": 1,
				"plans": ["supergrok"],
				"label": "SuperGrok·X Premium+ 로그인",
				"badge": "SuperGrok 필요",
				"notes": []
			}, {
				"path": 2,
				"apiKey": true,
				"label": "xAI API 키 (종량제)",
				"notes": ["쓴 만큼 요금이 나가요."]
			}],
			"lockReason": "Grok Build는 SuperGrok 또는 X Premium+에서만 쓸 수 있어요 (무료 불가)",
			"confidence": "third-party",
			"sourceUrl": "https://amplifying.ai/coding-agents/grok-build",
			"lastVerified": "2026-11-16",
			"configFormat": ".grok/agents/*.md",
			"configSourceUrl": "https://docs.x.ai/build/features/subagents"
		},
		"api": {
			"name": "API 직접 호출",
			"provider": null,
			"status": "builtin",
			"access": [],
			"lockReason": "API 키가 하나도 없어요",
			"confidence": "official",
			"sourceUrl": "",
			"lastVerified": "2026-11-16"
		},
		"manual": {
			"name": "수동 (복사·붙여넣기)",
			"provider": null,
			"status": "builtin",
			"access": [],
			"lockReason": "",
			"confidence": "official",
			"sourceUrl": "",
			"lastVerified": "2026-11-16"
		}
	}
};
// node_modules/process-nextick-args/index.js
var require_process_nextick_args = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (typeof process === "undefined" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0) module.exports = { nextTick };
	else module.exports = process;
	function nextTick(fn, arg1, arg2, arg3) {
		if (typeof fn !== "function") throw new TypeError("\"callback\" argument must be a function");
		var len = arguments.length;
		var args, i;
		switch (len) {
			case 0:
			case 1: return process.nextTick(fn);
			case 2: return process.nextTick(function afterTickOne() {
				fn.call(null, arg1);
			});
			case 3: return process.nextTick(function afterTickTwo() {
				fn.call(null, arg1, arg2);
			});
			case 4: return process.nextTick(function afterTickThree() {
				fn.call(null, arg1, arg2, arg3);
			});
			default:
				args = new Array(len - 1);
				i = 0;
				while (i < args.length) args[i++] = arguments[i];
				return process.nextTick(function afterTick() {
					fn.apply(null, args);
				});
		}
	}
}));
// node_modules/isarray/index.js
var require_isarray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toString = {}.toString;
	module.exports = Array.isArray || function(arr) {
		return toString.call(arr) == "[object Array]";
	};
}));
// node_modules/readable-stream/lib/internal/streams/stream.js
var require_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = __require("stream");
}));
// node_modules/safe-buffer/index.js
var require_safe_buffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var buffer = __require("buffer");
	var Buffer = buffer.Buffer;
	function copyProps(src, dst) {
		for (var key in src) dst[key] = src[key];
	}
	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) module.exports = buffer;
	else {
		copyProps(buffer, exports);
		exports.Buffer = SafeBuffer;
	}
	function SafeBuffer(arg, encodingOrOffset, length) {
		return Buffer(arg, encodingOrOffset, length);
	}
	copyProps(Buffer, SafeBuffer);
	SafeBuffer.from = function(arg, encodingOrOffset, length) {
		if (typeof arg === "number") throw new TypeError("Argument must not be a number");
		return Buffer(arg, encodingOrOffset, length);
	};
	SafeBuffer.alloc = function(size, fill, encoding) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		var buf = Buffer(size);
		if (fill !== void 0) {
			if (typeof encoding === "string") buf.fill(fill, encoding);
			else buf.fill(fill);
		} else buf.fill(0);
		return buf;
	};
	SafeBuffer.allocUnsafe = function(size) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		return Buffer(size);
	};
	SafeBuffer.allocUnsafeSlow = function(size) {
		if (typeof size !== "number") throw new TypeError("Argument must be a number");
		return buffer.SlowBuffer(size);
	};
}));
// node_modules/core-util-is/lib/util.js
var require_util = /* @__PURE__ */ __commonJSMin(((exports) => {
	function isArray(arg) {
		if (Array.isArray) return Array.isArray(arg);
		return objectToString(arg) === "[object Array]";
	}
	exports.isArray = isArray;
	function isBoolean(arg) {
		return typeof arg === "boolean";
	}
	exports.isBoolean = isBoolean;
	function isNull(arg) {
		return arg === null;
	}
	exports.isNull = isNull;
	function isNullOrUndefined(arg) {
		return arg == null;
	}
	exports.isNullOrUndefined = isNullOrUndefined;
	function isNumber(arg) {
		return typeof arg === "number";
	}
	exports.isNumber = isNumber;
	function isString(arg) {
		return typeof arg === "string";
	}
	exports.isString = isString;
	function isSymbol(arg) {
		return typeof arg === "symbol";
	}
	exports.isSymbol = isSymbol;
	function isUndefined(arg) {
		return arg === void 0;
	}
	exports.isUndefined = isUndefined;
	function isRegExp(re) {
		return objectToString(re) === "[object RegExp]";
	}
	exports.isRegExp = isRegExp;
	function isObject(arg) {
		return typeof arg === "object" && arg !== null;
	}
	exports.isObject = isObject;
	function isDate(d) {
		return objectToString(d) === "[object Date]";
	}
	exports.isDate = isDate;
	function isError(e) {
		return objectToString(e) === "[object Error]" || e instanceof Error;
	}
	exports.isError = isError;
	function isFunction(arg) {
		return typeof arg === "function";
	}
	exports.isFunction = isFunction;
	function isPrimitive(arg) {
		return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || typeof arg === "undefined";
	}
	exports.isPrimitive = isPrimitive;
	exports.isBuffer = __require("buffer").Buffer.isBuffer;
	function objectToString(o) {
		return Object.prototype.toString.call(o);
	}
}));
// node_modules/inherits/inherits_browser.js
var require_inherits_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (typeof Object.create === "function") module.exports = function inherits(ctor, superCtor) {
		if (superCtor) {
			ctor.super_ = superCtor;
			ctor.prototype = Object.create(superCtor.prototype, { constructor: {
				value: ctor,
				enumerable: false,
				writable: true,
				configurable: true
			} });
		}
	};
	else module.exports = function inherits(ctor, superCtor) {
		if (superCtor) {
			ctor.super_ = superCtor;
			var TempCtor = function() {};
			TempCtor.prototype = superCtor.prototype;
			ctor.prototype = new TempCtor();
			ctor.prototype.constructor = ctor;
		}
	};
}));
// node_modules/inherits/inherits.js
var require_inherits = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	try {
		var util = __require("util");
		/* istanbul ignore next */
		if (typeof util.inherits !== "function") throw "";
		module.exports = util.inherits;
	} catch (e) {
		/* istanbul ignore next */
		module.exports = require_inherits_browser();
	}
}));
// node_modules/readable-stream/lib/internal/streams/BufferList.js
var require_BufferList = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
	}
	var Buffer = require_safe_buffer().Buffer;
	var util = __require("util");
	function copyBuffer(src, target, offset) {
		src.copy(target, offset);
	}
	module.exports = function() {
		function BufferList() {
			_classCallCheck(this, BufferList);
			this.head = null;
			this.tail = null;
			this.length = 0;
		}
		BufferList.prototype.push = function push(v) {
			var entry = {
				data: v,
				next: null
			};
			if (this.length > 0) this.tail.next = entry;
			else this.head = entry;
			this.tail = entry;
			++this.length;
		};
		BufferList.prototype.unshift = function unshift(v) {
			var entry = {
				data: v,
				next: this.head
			};
			if (this.length === 0) this.tail = entry;
			this.head = entry;
			++this.length;
		};
		BufferList.prototype.shift = function shift() {
			if (this.length === 0) return;
			var ret = this.head.data;
			if (this.length === 1) this.head = this.tail = null;
			else this.head = this.head.next;
			--this.length;
			return ret;
		};
		BufferList.prototype.clear = function clear() {
			this.head = this.tail = null;
			this.length = 0;
		};
		BufferList.prototype.join = function join(s) {
			if (this.length === 0) return "";
			var p = this.head;
			var ret = "" + p.data;
			while (p = p.next) ret += s + p.data;
			return ret;
		};
		BufferList.prototype.concat = function concat(n) {
			if (this.length === 0) return Buffer.alloc(0);
			var ret = Buffer.allocUnsafe(n >>> 0);
			var p = this.head;
			var i = 0;
			while (p) {
				copyBuffer(p.data, ret, i);
				i += p.data.length;
				p = p.next;
			}
			return ret;
		};
		return BufferList;
	}();
	if (util && util.inspect && util.inspect.custom) module.exports.prototype[util.inspect.custom] = function() {
		var obj = util.inspect({ length: this.length });
		return this.constructor.name + " " + obj;
	};
}));
// node_modules/readable-stream/lib/internal/streams/destroy.js
var require_destroy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pna = require_process_nextick_args();
	function destroy(err, cb) {
		var _this = this;
		var readableDestroyed = this._readableState && this._readableState.destroyed;
		var writableDestroyed = this._writableState && this._writableState.destroyed;
		if (readableDestroyed || writableDestroyed) {
			if (cb) cb(err);
			else if (err) {
				if (!this._writableState) pna.nextTick(emitErrorNT, this, err);
				else if (!this._writableState.errorEmitted) {
					this._writableState.errorEmitted = true;
					pna.nextTick(emitErrorNT, this, err);
				}
			}
			return this;
		}
		if (this._readableState) this._readableState.destroyed = true;
		if (this._writableState) this._writableState.destroyed = true;
		this._destroy(err || null, function(err) {
			if (!cb && err) {
				if (!_this._writableState) pna.nextTick(emitErrorNT, _this, err);
				else if (!_this._writableState.errorEmitted) {
					_this._writableState.errorEmitted = true;
					pna.nextTick(emitErrorNT, _this, err);
				}
			} else if (cb) cb(err);
		});
		return this;
	}
	function undestroy() {
		if (this._readableState) {
			this._readableState.destroyed = false;
			this._readableState.reading = false;
			this._readableState.ended = false;
			this._readableState.endEmitted = false;
		}
		if (this._writableState) {
			this._writableState.destroyed = false;
			this._writableState.ended = false;
			this._writableState.ending = false;
			this._writableState.finalCalled = false;
			this._writableState.prefinished = false;
			this._writableState.finished = false;
			this._writableState.errorEmitted = false;
		}
	}
	function emitErrorNT(self, err) {
		self.emit("error", err);
	}
	module.exports = {
		destroy,
		undestroy
	};
}));
// node_modules/util-deprecate/node.js
var require_node = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* For Node.js, simply re-export the core `util.deprecate` function.
	*/
	module.exports = __require("util").deprecate;
}));
// node_modules/readable-stream/lib/_stream_writable.js
var require__stream_writable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pna = require_process_nextick_args();
	module.exports = Writable;
	function CorkedRequest(state) {
		var _this = this;
		this.next = null;
		this.entry = null;
		this.finish = function() {
			onCorkedFinish(_this, state);
		};
	}
	var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
	var Duplex;
	Writable.WritableState = WritableState;
	var util = Object.create(require_util());
	util.inherits = require_inherits();
	var internalUtil = { deprecate: require_node() };
	var Stream = require_stream();
	var Buffer = require_safe_buffer().Buffer;
	var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {};
	function _uint8ArrayToBuffer(chunk) {
		return Buffer.from(chunk);
	}
	function _isUint8Array(obj) {
		return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}
	var destroyImpl = require_destroy();
	util.inherits(Writable, Stream);
	function nop() {}
	function WritableState(options, stream) {
		Duplex = Duplex || require__stream_duplex();
		options = options || {};
		var isDuplex = stream instanceof Duplex;
		this.objectMode = !!options.objectMode;
		if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
		var hwm = options.highWaterMark;
		var writableHwm = options.writableHighWaterMark;
		var defaultHwm = this.objectMode ? 16 : 16384;
		if (hwm || hwm === 0) this.highWaterMark = hwm;
		else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
		else this.highWaterMark = defaultHwm;
		this.highWaterMark = Math.floor(this.highWaterMark);
		this.finalCalled = false;
		this.needDrain = false;
		this.ending = false;
		this.ended = false;
		this.finished = false;
		this.destroyed = false;
		var noDecode = options.decodeStrings === false;
		this.decodeStrings = !noDecode;
		this.defaultEncoding = options.defaultEncoding || "utf8";
		this.length = 0;
		this.writing = false;
		this.corked = 0;
		this.sync = true;
		this.bufferProcessing = false;
		this.onwrite = function(er) {
			onwrite(stream, er);
		};
		this.writecb = null;
		this.writelen = 0;
		this.bufferedRequest = null;
		this.lastBufferedRequest = null;
		this.pendingcb = 0;
		this.prefinished = false;
		this.errorEmitted = false;
		this.bufferedRequestCount = 0;
		this.corkedRequestsFree = new CorkedRequest(this);
	}
	WritableState.prototype.getBuffer = function getBuffer() {
		var current = this.bufferedRequest;
		var out = [];
		while (current) {
			out.push(current);
			current = current.next;
		}
		return out;
	};
	(function() {
		try {
			Object.defineProperty(WritableState.prototype, "buffer", { get: internalUtil.deprecate(function() {
				return this.getBuffer();
			}, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003") });
		} catch (_) {}
	})();
	var realHasInstance;
	if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
		realHasInstance = Function.prototype[Symbol.hasInstance];
		Object.defineProperty(Writable, Symbol.hasInstance, { value: function(object) {
			if (realHasInstance.call(this, object)) return true;
			if (this !== Writable) return false;
			return object && object._writableState instanceof WritableState;
		} });
	} else realHasInstance = function(object) {
		return object instanceof this;
	};
	function Writable(options) {
		Duplex = Duplex || require__stream_duplex();
		if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) return new Writable(options);
		this._writableState = new WritableState(options, this);
		this.writable = true;
		if (options) {
			if (typeof options.write === "function") this._write = options.write;
			if (typeof options.writev === "function") this._writev = options.writev;
			if (typeof options.destroy === "function") this._destroy = options.destroy;
			if (typeof options.final === "function") this._final = options.final;
		}
		Stream.call(this);
	}
	Writable.prototype.pipe = function() {
		this.emit("error", /* @__PURE__ */ new Error("Cannot pipe, not readable"));
	};
	function writeAfterEnd(stream, cb) {
		var er = /* @__PURE__ */ new Error("write after end");
		stream.emit("error", er);
		pna.nextTick(cb, er);
	}
	function validChunk(stream, state, chunk, cb) {
		var valid = true;
		var er = false;
		if (chunk === null) er = /* @__PURE__ */ new TypeError("May not write null values to stream");
		else if (typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) er = /* @__PURE__ */ new TypeError("Invalid non-string/buffer chunk");
		if (er) {
			stream.emit("error", er);
			pna.nextTick(cb, er);
			valid = false;
		}
		return valid;
	}
	Writable.prototype.write = function(chunk, encoding, cb) {
		var state = this._writableState;
		var ret = false;
		var isBuf = !state.objectMode && _isUint8Array(chunk);
		if (isBuf && !Buffer.isBuffer(chunk)) chunk = _uint8ArrayToBuffer(chunk);
		if (typeof encoding === "function") {
			cb = encoding;
			encoding = null;
		}
		if (isBuf) encoding = "buffer";
		else if (!encoding) encoding = state.defaultEncoding;
		if (typeof cb !== "function") cb = nop;
		if (state.ended) writeAfterEnd(this, cb);
		else if (isBuf || validChunk(this, state, chunk, cb)) {
			state.pendingcb++;
			ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
		}
		return ret;
	};
	Writable.prototype.cork = function() {
		var state = this._writableState;
		state.corked++;
	};
	Writable.prototype.uncork = function() {
		var state = this._writableState;
		if (state.corked) {
			state.corked--;
			if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
		}
	};
	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
		if (typeof encoding === "string") encoding = encoding.toLowerCase();
		if (!([
			"hex",
			"utf8",
			"utf-8",
			"ascii",
			"binary",
			"base64",
			"ucs2",
			"ucs-2",
			"utf16le",
			"utf-16le",
			"raw"
		].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
		this._writableState.defaultEncoding = encoding;
		return this;
	};
	function decodeChunk(state, chunk, encoding) {
		if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") chunk = Buffer.from(chunk, encoding);
		return chunk;
	}
	Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
		enumerable: false,
		get: function() {
			return this._writableState.highWaterMark;
		}
	});
	function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
		if (!isBuf) {
			var newChunk = decodeChunk(state, chunk, encoding);
			if (chunk !== newChunk) {
				isBuf = true;
				encoding = "buffer";
				chunk = newChunk;
			}
		}
		var len = state.objectMode ? 1 : chunk.length;
		state.length += len;
		var ret = state.length < state.highWaterMark;
		if (!ret) state.needDrain = true;
		if (state.writing || state.corked) {
			var last = state.lastBufferedRequest;
			state.lastBufferedRequest = {
				chunk,
				encoding,
				isBuf,
				callback: cb,
				next: null
			};
			if (last) last.next = state.lastBufferedRequest;
			else state.bufferedRequest = state.lastBufferedRequest;
			state.bufferedRequestCount += 1;
		} else doWrite(stream, state, false, len, chunk, encoding, cb);
		return ret;
	}
	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
		state.writelen = len;
		state.writecb = cb;
		state.writing = true;
		state.sync = true;
		if (writev) stream._writev(chunk, state.onwrite);
		else stream._write(chunk, encoding, state.onwrite);
		state.sync = false;
	}
	function onwriteError(stream, state, sync, er, cb) {
		--state.pendingcb;
		if (sync) {
			pna.nextTick(cb, er);
			pna.nextTick(finishMaybe, stream, state);
			stream._writableState.errorEmitted = true;
			stream.emit("error", er);
		} else {
			cb(er);
			stream._writableState.errorEmitted = true;
			stream.emit("error", er);
			finishMaybe(stream, state);
		}
	}
	function onwriteStateUpdate(state) {
		state.writing = false;
		state.writecb = null;
		state.length -= state.writelen;
		state.writelen = 0;
	}
	function onwrite(stream, er) {
		var state = stream._writableState;
		var sync = state.sync;
		var cb = state.writecb;
		onwriteStateUpdate(state);
		if (er) onwriteError(stream, state, sync, er, cb);
		else {
			var finished = needFinish(state);
			if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(stream, state);
			if (sync) asyncWrite(afterWrite, stream, state, finished, cb);
			else afterWrite(stream, state, finished, cb);
		}
	}
	function afterWrite(stream, state, finished, cb) {
		if (!finished) onwriteDrain(stream, state);
		state.pendingcb--;
		cb();
		finishMaybe(stream, state);
	}
	function onwriteDrain(stream, state) {
		if (state.length === 0 && state.needDrain) {
			state.needDrain = false;
			stream.emit("drain");
		}
	}
	function clearBuffer(stream, state) {
		state.bufferProcessing = true;
		var entry = state.bufferedRequest;
		if (stream._writev && entry && entry.next) {
			var l = state.bufferedRequestCount;
			var buffer = new Array(l);
			var holder = state.corkedRequestsFree;
			holder.entry = entry;
			var count = 0;
			var allBuffers = true;
			while (entry) {
				buffer[count] = entry;
				if (!entry.isBuf) allBuffers = false;
				entry = entry.next;
				count += 1;
			}
			buffer.allBuffers = allBuffers;
			doWrite(stream, state, true, state.length, buffer, "", holder.finish);
			state.pendingcb++;
			state.lastBufferedRequest = null;
			if (holder.next) {
				state.corkedRequestsFree = holder.next;
				holder.next = null;
			} else state.corkedRequestsFree = new CorkedRequest(state);
			state.bufferedRequestCount = 0;
		} else {
			while (entry) {
				var chunk = entry.chunk;
				var encoding = entry.encoding;
				var cb = entry.callback;
				doWrite(stream, state, false, state.objectMode ? 1 : chunk.length, chunk, encoding, cb);
				entry = entry.next;
				state.bufferedRequestCount--;
				if (state.writing) break;
			}
			if (entry === null) state.lastBufferedRequest = null;
		}
		state.bufferedRequest = entry;
		state.bufferProcessing = false;
	}
	Writable.prototype._write = function(chunk, encoding, cb) {
		cb(/* @__PURE__ */ new Error("_write() is not implemented"));
	};
	Writable.prototype._writev = null;
	Writable.prototype.end = function(chunk, encoding, cb) {
		var state = this._writableState;
		if (typeof chunk === "function") {
			cb = chunk;
			chunk = null;
			encoding = null;
		} else if (typeof encoding === "function") {
			cb = encoding;
			encoding = null;
		}
		if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
		if (state.corked) {
			state.corked = 1;
			this.uncork();
		}
		if (!state.ending) endWritable(this, state, cb);
	};
	function needFinish(state) {
		return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
	}
	function callFinal(stream, state) {
		stream._final(function(err) {
			state.pendingcb--;
			if (err) stream.emit("error", err);
			state.prefinished = true;
			stream.emit("prefinish");
			finishMaybe(stream, state);
		});
	}
	function prefinish(stream, state) {
		if (!state.prefinished && !state.finalCalled) {
			if (typeof stream._final === "function") {
				state.pendingcb++;
				state.finalCalled = true;
				pna.nextTick(callFinal, stream, state);
			} else {
				state.prefinished = true;
				stream.emit("prefinish");
			}
		}
	}
	function finishMaybe(stream, state) {
		var need = needFinish(state);
		if (need) {
			prefinish(stream, state);
			if (state.pendingcb === 0) {
				state.finished = true;
				stream.emit("finish");
			}
		}
		return need;
	}
	function endWritable(stream, state, cb) {
		state.ending = true;
		finishMaybe(stream, state);
		if (cb) {
			if (state.finished) pna.nextTick(cb);
			else stream.once("finish", cb);
		}
		state.ended = true;
		stream.writable = false;
	}
	function onCorkedFinish(corkReq, state, err) {
		var entry = corkReq.entry;
		corkReq.entry = null;
		while (entry) {
			var cb = entry.callback;
			state.pendingcb--;
			cb(err);
			entry = entry.next;
		}
		state.corkedRequestsFree.next = corkReq;
	}
	Object.defineProperty(Writable.prototype, "destroyed", {
		get: function() {
			if (this._writableState === void 0) return false;
			return this._writableState.destroyed;
		},
		set: function(value) {
			if (!this._writableState) return;
			this._writableState.destroyed = value;
		}
	});
	Writable.prototype.destroy = destroyImpl.destroy;
	Writable.prototype._undestroy = destroyImpl.undestroy;
	Writable.prototype._destroy = function(err, cb) {
		this.end();
		cb(err);
	};
}));
// node_modules/readable-stream/lib/_stream_duplex.js
var require__stream_duplex = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pna = require_process_nextick_args();
	var objectKeys = Object.keys || function(obj) {
		var keys = [];
		for (var key in obj) keys.push(key);
		return keys;
	};
	module.exports = Duplex;
	var util = Object.create(require_util());
	util.inherits = require_inherits();
	var Readable = require__stream_readable();
	var Writable = require__stream_writable();
	util.inherits(Duplex, Readable);
	var keys = objectKeys(Writable.prototype);
	for (var v = 0; v < keys.length; v++) {
		var method = keys[v];
		if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
	}
	function Duplex(options) {
		if (!(this instanceof Duplex)) return new Duplex(options);
		Readable.call(this, options);
		Writable.call(this, options);
		if (options && options.readable === false) this.readable = false;
		if (options && options.writable === false) this.writable = false;
		this.allowHalfOpen = true;
		if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
		this.once("end", onend);
	}
	Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
		enumerable: false,
		get: function() {
			return this._writableState.highWaterMark;
		}
	});
	function onend() {
		if (this.allowHalfOpen || this._writableState.ended) return;
		pna.nextTick(onEndNT, this);
	}
	function onEndNT(self) {
		self.end();
	}
	Object.defineProperty(Duplex.prototype, "destroyed", {
		get: function() {
			if (this._readableState === void 0 || this._writableState === void 0) return false;
			return this._readableState.destroyed && this._writableState.destroyed;
		},
		set: function(value) {
			if (this._readableState === void 0 || this._writableState === void 0) return;
			this._readableState.destroyed = value;
			this._writableState.destroyed = value;
		}
	});
	Duplex.prototype._destroy = function(err, cb) {
		this.push(null);
		this.end();
		pna.nextTick(cb, err);
	};
}));
// node_modules/string_decoder/lib/string_decoder.js
var require_string_decoder = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Buffer = require_safe_buffer().Buffer;
	var isEncoding = Buffer.isEncoding || function(encoding) {
		encoding = "" + encoding;
		switch (encoding && encoding.toLowerCase()) {
			case "hex":
			case "utf8":
			case "utf-8":
			case "ascii":
			case "binary":
			case "base64":
			case "ucs2":
			case "ucs-2":
			case "utf16le":
			case "utf-16le":
			case "raw": return true;
			default: return false;
		}
	};
	function _normalizeEncoding(enc) {
		if (!enc) return "utf8";
		var retried;
		while (true) switch (enc) {
			case "utf8":
			case "utf-8": return "utf8";
			case "ucs2":
			case "ucs-2":
			case "utf16le":
			case "utf-16le": return "utf16le";
			case "latin1":
			case "binary": return "latin1";
			case "base64":
			case "ascii":
			case "hex": return enc;
			default:
				if (retried) return;
				enc = ("" + enc).toLowerCase();
				retried = true;
		}
	}
	function normalizeEncoding(enc) {
		var nenc = _normalizeEncoding(enc);
		if (typeof nenc !== "string" && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
		return nenc || enc;
	}
	exports.StringDecoder = StringDecoder;
	function StringDecoder(encoding) {
		this.encoding = normalizeEncoding(encoding);
		var nb;
		switch (this.encoding) {
			case "utf16le":
				this.text = utf16Text;
				this.end = utf16End;
				nb = 4;
				break;
			case "utf8":
				this.fillLast = utf8FillLast;
				nb = 4;
				break;
			case "base64":
				this.text = base64Text;
				this.end = base64End;
				nb = 3;
				break;
			default:
				this.write = simpleWrite;
				this.end = simpleEnd;
				return;
		}
		this.lastNeed = 0;
		this.lastTotal = 0;
		this.lastChar = Buffer.allocUnsafe(nb);
	}
	StringDecoder.prototype.write = function(buf) {
		if (buf.length === 0) return "";
		var r;
		var i;
		if (this.lastNeed) {
			r = this.fillLast(buf);
			if (r === void 0) return "";
			i = this.lastNeed;
			this.lastNeed = 0;
		} else i = 0;
		if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
		return r || "";
	};
	StringDecoder.prototype.end = utf8End;
	StringDecoder.prototype.text = utf8Text;
	StringDecoder.prototype.fillLast = function(buf) {
		if (this.lastNeed <= buf.length) {
			buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
			return this.lastChar.toString(this.encoding, 0, this.lastTotal);
		}
		buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
		this.lastNeed -= buf.length;
	};
	function utf8CheckByte(byte) {
		if (byte <= 127) return 0;
		else if (byte >> 5 === 6) return 2;
		else if (byte >> 4 === 14) return 3;
		else if (byte >> 3 === 30) return 4;
		return byte >> 6 === 2 ? -1 : -2;
	}
	function utf8CheckIncomplete(self, buf, i) {
		var j = buf.length - 1;
		if (j < i) return 0;
		var nb = utf8CheckByte(buf[j]);
		if (nb >= 0) {
			if (nb > 0) self.lastNeed = nb - 1;
			return nb;
		}
		if (--j < i || nb === -2) return 0;
		nb = utf8CheckByte(buf[j]);
		if (nb >= 0) {
			if (nb > 0) self.lastNeed = nb - 2;
			return nb;
		}
		if (--j < i || nb === -2) return 0;
		nb = utf8CheckByte(buf[j]);
		if (nb >= 0) {
			if (nb > 0) {
				if (nb === 2) nb = 0;
				else self.lastNeed = nb - 3;
			}
			return nb;
		}
		return 0;
	}
	function utf8CheckExtraBytes(self, buf, p) {
		if ((buf[0] & 192) !== 128) {
			self.lastNeed = 0;
			return "�";
		}
		if (self.lastNeed > 1 && buf.length > 1) {
			if ((buf[1] & 192) !== 128) {
				self.lastNeed = 1;
				return "�";
			}
			if (self.lastNeed > 2 && buf.length > 2) {
				if ((buf[2] & 192) !== 128) {
					self.lastNeed = 2;
					return "�";
				}
			}
		}
	}
	function utf8FillLast(buf) {
		var p = this.lastTotal - this.lastNeed;
		var r = utf8CheckExtraBytes(this, buf, p);
		if (r !== void 0) return r;
		if (this.lastNeed <= buf.length) {
			buf.copy(this.lastChar, p, 0, this.lastNeed);
			return this.lastChar.toString(this.encoding, 0, this.lastTotal);
		}
		buf.copy(this.lastChar, p, 0, buf.length);
		this.lastNeed -= buf.length;
	}
	function utf8Text(buf, i) {
		var total = utf8CheckIncomplete(this, buf, i);
		if (!this.lastNeed) return buf.toString("utf8", i);
		this.lastTotal = total;
		var end = buf.length - (total - this.lastNeed);
		buf.copy(this.lastChar, 0, end);
		return buf.toString("utf8", i, end);
	}
	function utf8End(buf) {
		var r = buf && buf.length ? this.write(buf) : "";
		if (this.lastNeed) return r + "�";
		return r;
	}
	function utf16Text(buf, i) {
		if ((buf.length - i) % 2 === 0) {
			var r = buf.toString("utf16le", i);
			if (r) {
				var c = r.charCodeAt(r.length - 1);
				if (c >= 55296 && c <= 56319) {
					this.lastNeed = 2;
					this.lastTotal = 4;
					this.lastChar[0] = buf[buf.length - 2];
					this.lastChar[1] = buf[buf.length - 1];
					return r.slice(0, -1);
				}
			}
			return r;
		}
		this.lastNeed = 1;
		this.lastTotal = 2;
		this.lastChar[0] = buf[buf.length - 1];
		return buf.toString("utf16le", i, buf.length - 1);
	}
	function utf16End(buf) {
		var r = buf && buf.length ? this.write(buf) : "";
		if (this.lastNeed) {
			var end = this.lastTotal - this.lastNeed;
			return r + this.lastChar.toString("utf16le", 0, end);
		}
		return r;
	}
	function base64Text(buf, i) {
		var n = (buf.length - i) % 3;
		if (n === 0) return buf.toString("base64", i);
		this.lastNeed = 3 - n;
		this.lastTotal = 3;
		if (n === 1) this.lastChar[0] = buf[buf.length - 1];
		else {
			this.lastChar[0] = buf[buf.length - 2];
			this.lastChar[1] = buf[buf.length - 1];
		}
		return buf.toString("base64", i, buf.length - n);
	}
	function base64End(buf) {
		var r = buf && buf.length ? this.write(buf) : "";
		if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
		return r;
	}
	function simpleWrite(buf) {
		return buf.toString(this.encoding);
	}
	function simpleEnd(buf) {
		return buf && buf.length ? this.write(buf) : "";
	}
}));
// node_modules/readable-stream/lib/_stream_readable.js
var require__stream_readable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pna = require_process_nextick_args();
	module.exports = Readable;
	var isArray = require_isarray();
	var Duplex;
	Readable.ReadableState = ReadableState;
	__require("events").EventEmitter;
	var EElistenerCount = function(emitter, type) {
		return emitter.listeners(type).length;
	};
	var Stream = require_stream();
	var Buffer = require_safe_buffer().Buffer;
	var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {};
	function _uint8ArrayToBuffer(chunk) {
		return Buffer.from(chunk);
	}
	function _isUint8Array(obj) {
		return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
	}
	var util = Object.create(require_util());
	util.inherits = require_inherits();
	var debugUtil = __require("util");
	var debug = void 0;
	if (debugUtil && debugUtil.debuglog) debug = debugUtil.debuglog("stream");
	else debug = function() {};
	var BufferList = require_BufferList();
	var destroyImpl = require_destroy();
	var StringDecoder;
	util.inherits(Readable, Stream);
	var kProxyEvents = [
		"error",
		"close",
		"destroy",
		"pause",
		"resume"
	];
	function prependListener(emitter, event, fn) {
		if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
		if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
		else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);
		else emitter._events[event] = [fn, emitter._events[event]];
	}
	function ReadableState(options, stream) {
		Duplex = Duplex || require__stream_duplex();
		options = options || {};
		var isDuplex = stream instanceof Duplex;
		this.objectMode = !!options.objectMode;
		if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
		var hwm = options.highWaterMark;
		var readableHwm = options.readableHighWaterMark;
		var defaultHwm = this.objectMode ? 16 : 16384;
		if (hwm || hwm === 0) this.highWaterMark = hwm;
		else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
		else this.highWaterMark = defaultHwm;
		this.highWaterMark = Math.floor(this.highWaterMark);
		this.buffer = new BufferList();
		this.length = 0;
		this.pipes = null;
		this.pipesCount = 0;
		this.flowing = null;
		this.ended = false;
		this.endEmitted = false;
		this.reading = false;
		this.sync = true;
		this.needReadable = false;
		this.emittedReadable = false;
		this.readableListening = false;
		this.resumeScheduled = false;
		this.destroyed = false;
		this.defaultEncoding = options.defaultEncoding || "utf8";
		this.awaitDrain = 0;
		this.readingMore = false;
		this.decoder = null;
		this.encoding = null;
		if (options.encoding) {
			if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
			this.decoder = new StringDecoder(options.encoding);
			this.encoding = options.encoding;
		}
	}
	function Readable(options) {
		Duplex = Duplex || require__stream_duplex();
		if (!(this instanceof Readable)) return new Readable(options);
		this._readableState = new ReadableState(options, this);
		this.readable = true;
		if (options) {
			if (typeof options.read === "function") this._read = options.read;
			if (typeof options.destroy === "function") this._destroy = options.destroy;
		}
		Stream.call(this);
	}
	Object.defineProperty(Readable.prototype, "destroyed", {
		get: function() {
			if (this._readableState === void 0) return false;
			return this._readableState.destroyed;
		},
		set: function(value) {
			if (!this._readableState) return;
			this._readableState.destroyed = value;
		}
	});
	Readable.prototype.destroy = destroyImpl.destroy;
	Readable.prototype._undestroy = destroyImpl.undestroy;
	Readable.prototype._destroy = function(err, cb) {
		this.push(null);
		cb(err);
	};
	Readable.prototype.push = function(chunk, encoding) {
		var state = this._readableState;
		var skipChunkCheck;
		if (!state.objectMode) {
			if (typeof chunk === "string") {
				encoding = encoding || state.defaultEncoding;
				if (encoding !== state.encoding) {
					chunk = Buffer.from(chunk, encoding);
					encoding = "";
				}
				skipChunkCheck = true;
			}
		} else skipChunkCheck = true;
		return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
	};
	Readable.prototype.unshift = function(chunk) {
		return readableAddChunk(this, chunk, null, true, false);
	};
	function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
		var state = stream._readableState;
		if (chunk === null) {
			state.reading = false;
			onEofChunk(stream, state);
		} else {
			var er;
			if (!skipChunkCheck) er = chunkInvalid(state, chunk);
			if (er) stream.emit("error", er);
			else if (state.objectMode || chunk && chunk.length > 0) {
				if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) chunk = _uint8ArrayToBuffer(chunk);
				if (addToFront) {
					if (state.endEmitted) stream.emit("error", /* @__PURE__ */ new Error("stream.unshift() after end event"));
					else addChunk(stream, state, chunk, true);
				} else if (state.ended) stream.emit("error", /* @__PURE__ */ new Error("stream.push() after EOF"));
				else {
					state.reading = false;
					if (state.decoder && !encoding) {
						chunk = state.decoder.write(chunk);
						if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
						else maybeReadMore(stream, state);
					} else addChunk(stream, state, chunk, false);
				}
			} else if (!addToFront) state.reading = false;
		}
		return needMoreData(state);
	}
	function addChunk(stream, state, chunk, addToFront) {
		if (state.flowing && state.length === 0 && !state.sync) {
			stream.emit("data", chunk);
			stream.read(0);
		} else {
			state.length += state.objectMode ? 1 : chunk.length;
			if (addToFront) state.buffer.unshift(chunk);
			else state.buffer.push(chunk);
			if (state.needReadable) emitReadable(stream);
		}
		maybeReadMore(stream, state);
	}
	function chunkInvalid(state, chunk) {
		var er;
		if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) er = /* @__PURE__ */ new TypeError("Invalid non-string/buffer chunk");
		return er;
	}
	function needMoreData(state) {
		return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
	}
	Readable.prototype.isPaused = function() {
		return this._readableState.flowing === false;
	};
	Readable.prototype.setEncoding = function(enc) {
		if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
		this._readableState.decoder = new StringDecoder(enc);
		this._readableState.encoding = enc;
		return this;
	};
	var MAX_HWM = 8388608;
	function computeNewHighWaterMark(n) {
		if (n >= MAX_HWM) n = MAX_HWM;
		else {
			n--;
			n |= n >>> 1;
			n |= n >>> 2;
			n |= n >>> 4;
			n |= n >>> 8;
			n |= n >>> 16;
			n++;
		}
		return n;
	}
	function howMuchToRead(n, state) {
		if (n <= 0 || state.length === 0 && state.ended) return 0;
		if (state.objectMode) return 1;
		if (n !== n) {
			if (state.flowing && state.length) return state.buffer.head.data.length;
			else return state.length;
		}
		if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
		if (n <= state.length) return n;
		if (!state.ended) {
			state.needReadable = true;
			return 0;
		}
		return state.length;
	}
	Readable.prototype.read = function(n) {
		debug("read", n);
		n = parseInt(n, 10);
		var state = this._readableState;
		var nOrig = n;
		if (n !== 0) state.emittedReadable = false;
		if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
			debug("read: emitReadable", state.length, state.ended);
			if (state.length === 0 && state.ended) endReadable(this);
			else emitReadable(this);
			return null;
		}
		n = howMuchToRead(n, state);
		if (n === 0 && state.ended) {
			if (state.length === 0) endReadable(this);
			return null;
		}
		var doRead = state.needReadable;
		debug("need readable", doRead);
		if (state.length === 0 || state.length - n < state.highWaterMark) {
			doRead = true;
			debug("length less than watermark", doRead);
		}
		if (state.ended || state.reading) {
			doRead = false;
			debug("reading or ended", doRead);
		} else if (doRead) {
			debug("do read");
			state.reading = true;
			state.sync = true;
			if (state.length === 0) state.needReadable = true;
			this._read(state.highWaterMark);
			state.sync = false;
			if (!state.reading) n = howMuchToRead(nOrig, state);
		}
		var ret;
		if (n > 0) ret = fromList(n, state);
		else ret = null;
		if (ret === null) {
			state.needReadable = true;
			n = 0;
		} else state.length -= n;
		if (state.length === 0) {
			if (!state.ended) state.needReadable = true;
			if (nOrig !== n && state.ended) endReadable(this);
		}
		if (ret !== null) this.emit("data", ret);
		return ret;
	};
	function onEofChunk(stream, state) {
		if (state.ended) return;
		if (state.decoder) {
			var chunk = state.decoder.end();
			if (chunk && chunk.length) {
				state.buffer.push(chunk);
				state.length += state.objectMode ? 1 : chunk.length;
			}
		}
		state.ended = true;
		emitReadable(stream);
	}
	function emitReadable(stream) {
		var state = stream._readableState;
		state.needReadable = false;
		if (!state.emittedReadable) {
			debug("emitReadable", state.flowing);
			state.emittedReadable = true;
			if (state.sync) pna.nextTick(emitReadable_, stream);
			else emitReadable_(stream);
		}
	}
	function emitReadable_(stream) {
		debug("emit readable");
		stream.emit("readable");
		flow(stream);
	}
	function maybeReadMore(stream, state) {
		if (!state.readingMore) {
			state.readingMore = true;
			pna.nextTick(maybeReadMore_, stream, state);
		}
	}
	function maybeReadMore_(stream, state) {
		var len = state.length;
		while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
			debug("maybeReadMore read 0");
			stream.read(0);
			if (len === state.length) break;
			else len = state.length;
		}
		state.readingMore = false;
	}
	Readable.prototype._read = function(n) {
		this.emit("error", /* @__PURE__ */ new Error("_read() is not implemented"));
	};
	Readable.prototype.pipe = function(dest, pipeOpts) {
		var src = this;
		var state = this._readableState;
		switch (state.pipesCount) {
			case 0:
				state.pipes = dest;
				break;
			case 1:
				state.pipes = [state.pipes, dest];
				break;
			default: state.pipes.push(dest);
		}
		state.pipesCount += 1;
		debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
		var endFn = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr ? onend : unpipe;
		if (state.endEmitted) pna.nextTick(endFn);
		else src.once("end", endFn);
		dest.on("unpipe", onunpipe);
		function onunpipe(readable, unpipeInfo) {
			debug("onunpipe");
			if (readable === src) {
				if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
					unpipeInfo.hasUnpiped = true;
					cleanup();
				}
			}
		}
		function onend() {
			debug("onend");
			dest.end();
		}
		var ondrain = pipeOnDrain(src);
		dest.on("drain", ondrain);
		var cleanedUp = false;
		function cleanup() {
			debug("cleanup");
			dest.removeListener("close", onclose);
			dest.removeListener("finish", onfinish);
			dest.removeListener("drain", ondrain);
			dest.removeListener("error", onerror);
			dest.removeListener("unpipe", onunpipe);
			src.removeListener("end", onend);
			src.removeListener("end", unpipe);
			src.removeListener("data", ondata);
			cleanedUp = true;
			if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
		}
		var increasedAwaitDrain = false;
		src.on("data", ondata);
		function ondata(chunk) {
			debug("ondata");
			increasedAwaitDrain = false;
			if (false === dest.write(chunk) && !increasedAwaitDrain) {
				if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
					debug("false write response, pause", state.awaitDrain);
					state.awaitDrain++;
					increasedAwaitDrain = true;
				}
				src.pause();
			}
		}
		function onerror(er) {
			debug("onerror", er);
			unpipe();
			dest.removeListener("error", onerror);
			if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
		}
		prependListener(dest, "error", onerror);
		function onclose() {
			dest.removeListener("finish", onfinish);
			unpipe();
		}
		dest.once("close", onclose);
		function onfinish() {
			debug("onfinish");
			dest.removeListener("close", onclose);
			unpipe();
		}
		dest.once("finish", onfinish);
		function unpipe() {
			debug("unpipe");
			src.unpipe(dest);
		}
		dest.emit("pipe", src);
		if (!state.flowing) {
			debug("pipe resume");
			src.resume();
		}
		return dest;
	};
	function pipeOnDrain(src) {
		return function() {
			var state = src._readableState;
			debug("pipeOnDrain", state.awaitDrain);
			if (state.awaitDrain) state.awaitDrain--;
			if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
				state.flowing = true;
				flow(src);
			}
		};
	}
	Readable.prototype.unpipe = function(dest) {
		var state = this._readableState;
		var unpipeInfo = { hasUnpiped: false };
		if (state.pipesCount === 0) return this;
		if (state.pipesCount === 1) {
			if (dest && dest !== state.pipes) return this;
			if (!dest) dest = state.pipes;
			state.pipes = null;
			state.pipesCount = 0;
			state.flowing = false;
			if (dest) dest.emit("unpipe", this, unpipeInfo);
			return this;
		}
		if (!dest) {
			var dests = state.pipes;
			var len = state.pipesCount;
			state.pipes = null;
			state.pipesCount = 0;
			state.flowing = false;
			for (var i = 0; i < len; i++) dests[i].emit("unpipe", this, { hasUnpiped: false });
			return this;
		}
		var index = indexOf(state.pipes, dest);
		if (index === -1) return this;
		state.pipes.splice(index, 1);
		state.pipesCount -= 1;
		if (state.pipesCount === 1) state.pipes = state.pipes[0];
		dest.emit("unpipe", this, unpipeInfo);
		return this;
	};
	Readable.prototype.on = function(ev, fn) {
		var res = Stream.prototype.on.call(this, ev, fn);
		if (ev === "data") {
			if (this._readableState.flowing !== false) this.resume();
		} else if (ev === "readable") {
			var state = this._readableState;
			if (!state.endEmitted && !state.readableListening) {
				state.readableListening = state.needReadable = true;
				state.emittedReadable = false;
				if (!state.reading) pna.nextTick(nReadingNextTick, this);
				else if (state.length) emitReadable(this);
			}
		}
		return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;
	function nReadingNextTick(self) {
		debug("readable nexttick read 0");
		self.read(0);
	}
	Readable.prototype.resume = function() {
		var state = this._readableState;
		if (!state.flowing) {
			debug("resume");
			state.flowing = true;
			resume(this, state);
		}
		return this;
	};
	function resume(stream, state) {
		if (!state.resumeScheduled) {
			state.resumeScheduled = true;
			pna.nextTick(resume_, stream, state);
		}
	}
	function resume_(stream, state) {
		if (!state.reading) {
			debug("resume read 0");
			stream.read(0);
		}
		state.resumeScheduled = false;
		state.awaitDrain = 0;
		stream.emit("resume");
		flow(stream);
		if (state.flowing && !state.reading) stream.read(0);
	}
	Readable.prototype.pause = function() {
		debug("call pause flowing=%j", this._readableState.flowing);
		if (false !== this._readableState.flowing) {
			debug("pause");
			this._readableState.flowing = false;
			this.emit("pause");
		}
		return this;
	};
	function flow(stream) {
		var state = stream._readableState;
		debug("flow", state.flowing);
		while (state.flowing && stream.read() !== null);
	}
	Readable.prototype.wrap = function(stream) {
		var _this = this;
		var state = this._readableState;
		var paused = false;
		stream.on("end", function() {
			debug("wrapped end");
			if (state.decoder && !state.ended) {
				var chunk = state.decoder.end();
				if (chunk && chunk.length) _this.push(chunk);
			}
			_this.push(null);
		});
		stream.on("data", function(chunk) {
			debug("wrapped data");
			if (state.decoder) chunk = state.decoder.write(chunk);
			if (state.objectMode && (chunk === null || chunk === void 0)) return;
			else if (!state.objectMode && (!chunk || !chunk.length)) return;
			if (!_this.push(chunk)) {
				paused = true;
				stream.pause();
			}
		});
		for (var i in stream) if (this[i] === void 0 && typeof stream[i] === "function") this[i] = function(method) {
			return function() {
				return stream[method].apply(stream, arguments);
			};
		}(i);
		for (var n = 0; n < kProxyEvents.length; n++) stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
		this._read = function(n) {
			debug("wrapped _read", n);
			if (paused) {
				paused = false;
				stream.resume();
			}
		};
		return this;
	};
	Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
		enumerable: false,
		get: function() {
			return this._readableState.highWaterMark;
		}
	});
	Readable._fromList = fromList;
	function fromList(n, state) {
		if (state.length === 0) return null;
		var ret;
		if (state.objectMode) ret = state.buffer.shift();
		else if (!n || n >= state.length) {
			if (state.decoder) ret = state.buffer.join("");
			else if (state.buffer.length === 1) ret = state.buffer.head.data;
			else ret = state.buffer.concat(state.length);
			state.buffer.clear();
		} else ret = fromListPartial(n, state.buffer, state.decoder);
		return ret;
	}
	function fromListPartial(n, list, hasStrings) {
		var ret;
		if (n < list.head.data.length) {
			ret = list.head.data.slice(0, n);
			list.head.data = list.head.data.slice(n);
		} else if (n === list.head.data.length) ret = list.shift();
		else ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
		return ret;
	}
	function copyFromBufferString(n, list) {
		var p = list.head;
		var c = 1;
		var ret = p.data;
		n -= ret.length;
		while (p = p.next) {
			var str = p.data;
			var nb = n > str.length ? str.length : n;
			if (nb === str.length) ret += str;
			else ret += str.slice(0, n);
			n -= nb;
			if (n === 0) {
				if (nb === str.length) {
					++c;
					if (p.next) list.head = p.next;
					else list.head = list.tail = null;
				} else {
					list.head = p;
					p.data = str.slice(nb);
				}
				break;
			}
			++c;
		}
		list.length -= c;
		return ret;
	}
	function copyFromBuffer(n, list) {
		var ret = Buffer.allocUnsafe(n);
		var p = list.head;
		var c = 1;
		p.data.copy(ret);
		n -= p.data.length;
		while (p = p.next) {
			var buf = p.data;
			var nb = n > buf.length ? buf.length : n;
			buf.copy(ret, ret.length - n, 0, nb);
			n -= nb;
			if (n === 0) {
				if (nb === buf.length) {
					++c;
					if (p.next) list.head = p.next;
					else list.head = list.tail = null;
				} else {
					list.head = p;
					p.data = buf.slice(nb);
				}
				break;
			}
			++c;
		}
		list.length -= c;
		return ret;
	}
	function endReadable(stream) {
		var state = stream._readableState;
		if (state.length > 0) throw new Error("\"endReadable()\" called on non-empty stream");
		if (!state.endEmitted) {
			state.ended = true;
			pna.nextTick(endReadableNT, state, stream);
		}
	}
	function endReadableNT(state, stream) {
		if (!state.endEmitted && state.length === 0) {
			state.endEmitted = true;
			stream.readable = false;
			stream.emit("end");
		}
	}
	function indexOf(xs, x) {
		for (var i = 0, l = xs.length; i < l; i++) if (xs[i] === x) return i;
		return -1;
	}
}));
// node_modules/readable-stream/lib/_stream_transform.js
var require__stream_transform = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = Transform;
	var Duplex = require__stream_duplex();
	var util = Object.create(require_util());
	util.inherits = require_inherits();
	util.inherits(Transform, Duplex);
	function afterTransform(er, data) {
		var ts = this._transformState;
		ts.transforming = false;
		var cb = ts.writecb;
		if (!cb) return this.emit("error", /* @__PURE__ */ new Error("write callback called multiple times"));
		ts.writechunk = null;
		ts.writecb = null;
		if (data != null) this.push(data);
		cb(er);
		var rs = this._readableState;
		rs.reading = false;
		if (rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
	}
	function Transform(options) {
		if (!(this instanceof Transform)) return new Transform(options);
		Duplex.call(this, options);
		this._transformState = {
			afterTransform: afterTransform.bind(this),
			needTransform: false,
			transforming: false,
			writecb: null,
			writechunk: null,
			writeencoding: null
		};
		this._readableState.needReadable = true;
		this._readableState.sync = false;
		if (options) {
			if (typeof options.transform === "function") this._transform = options.transform;
			if (typeof options.flush === "function") this._flush = options.flush;
		}
		this.on("prefinish", prefinish);
	}
	function prefinish() {
		var _this = this;
		if (typeof this._flush === "function") this._flush(function(er, data) {
			done(_this, er, data);
		});
		else done(this, null, null);
	}
	Transform.prototype.push = function(chunk, encoding) {
		this._transformState.needTransform = false;
		return Duplex.prototype.push.call(this, chunk, encoding);
	};
	Transform.prototype._transform = function(chunk, encoding, cb) {
		throw new Error("_transform() is not implemented");
	};
	Transform.prototype._write = function(chunk, encoding, cb) {
		var ts = this._transformState;
		ts.writecb = cb;
		ts.writechunk = chunk;
		ts.writeencoding = encoding;
		if (!ts.transforming) {
			var rs = this._readableState;
			if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
		}
	};
	Transform.prototype._read = function(n) {
		var ts = this._transformState;
		if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
			ts.transforming = true;
			this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
		} else ts.needTransform = true;
	};
	Transform.prototype._destroy = function(err, cb) {
		var _this2 = this;
		Duplex.prototype._destroy.call(this, err, function(err2) {
			cb(err2);
			_this2.emit("close");
		});
	};
	function done(stream, er, data) {
		if (er) return stream.emit("error", er);
		if (data != null) stream.push(data);
		if (stream._writableState.length) throw new Error("Calling transform done when ws.length != 0");
		if (stream._transformState.transforming) throw new Error("Calling transform done when still transforming");
		return stream.push(null);
	}
}));
// node_modules/readable-stream/lib/_stream_passthrough.js
var require__stream_passthrough = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = PassThrough;
	var Transform = require__stream_transform();
	var util = Object.create(require_util());
	util.inherits = require_inherits();
	util.inherits(PassThrough, Transform);
	function PassThrough(options) {
		if (!(this instanceof PassThrough)) return new PassThrough(options);
		Transform.call(this, options);
	}
	PassThrough.prototype._transform = function(chunk, encoding, cb) {
		cb(null, chunk);
	};
}));
// node_modules/readable-stream/readable.js
var require_readable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stream = __require("stream");
	if (process.env.READABLE_STREAM === "disable" && Stream) {
		module.exports = Stream;
		exports = module.exports = Stream.Readable;
		exports.Readable = Stream.Readable;
		exports.Writable = Stream.Writable;
		exports.Duplex = Stream.Duplex;
		exports.Transform = Stream.Transform;
		exports.PassThrough = Stream.PassThrough;
		exports.Stream = Stream;
	} else {
		exports = module.exports = require__stream_readable();
		exports.Stream = Stream || exports;
		exports.Readable = exports;
		exports.Writable = require__stream_writable();
		exports.Duplex = require__stream_duplex();
		exports.Transform = require__stream_transform();
		exports.PassThrough = require__stream_passthrough();
	}
}));
// node_modules/jszip/lib/support.js
var require_support = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.base64 = true;
	exports.array = true;
	exports.string = true;
	exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
	exports.nodebuffer = typeof Buffer !== "undefined";
	exports.uint8array = typeof Uint8Array !== "undefined";
	if (typeof ArrayBuffer === "undefined") exports.blob = false;
	else {
		var buffer = /* @__PURE__ */ new ArrayBuffer(0);
		try {
			exports.blob = new Blob([buffer], { type: "application/zip" }).size === 0;
		} catch (e) {
			try {
				var builder = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
				builder.append(buffer);
				exports.blob = builder.getBlob("application/zip").size === 0;
			} catch (e) {
				exports.blob = false;
			}
		}
	}
	try {
		exports.nodestream = !!require_readable().Readable;
	} catch (e) {
		exports.nodestream = false;
	}
}));
// node_modules/jszip/lib/base64.js
var require_base64 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_utils();
	var support = require_support();
	var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	exports.encode = function(input) {
		var output = [];
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0, len = input.length, remainingBytes = len;
		var isArray = utils.getTypeOf(input) !== "string";
		while (i < input.length) {
			remainingBytes = len - i;
			if (!isArray) {
				chr1 = input.charCodeAt(i++);
				chr2 = i < len ? input.charCodeAt(i++) : 0;
				chr3 = i < len ? input.charCodeAt(i++) : 0;
			} else {
				chr1 = input[i++];
				chr2 = i < len ? input[i++] : 0;
				chr3 = i < len ? input[i++] : 0;
			}
			enc1 = chr1 >> 2;
			enc2 = (chr1 & 3) << 4 | chr2 >> 4;
			enc3 = remainingBytes > 1 ? (chr2 & 15) << 2 | chr3 >> 6 : 64;
			enc4 = remainingBytes > 2 ? chr3 & 63 : 64;
			output.push(_keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4));
		}
		return output.join("");
	};
	exports.decode = function(input) {
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0, resultIndex = 0;
		var dataUrlPrefix = "data:";
		if (input.substr(0, dataUrlPrefix.length) === dataUrlPrefix) throw new Error("Invalid base64 input, it looks like a data url.");
		input = input.replace(/[^A-Za-z0-9+/=]/g, "");
		var totalLength = input.length * 3 / 4;
		if (input.charAt(input.length - 1) === _keyStr.charAt(64)) totalLength--;
		if (input.charAt(input.length - 2) === _keyStr.charAt(64)) totalLength--;
		if (totalLength % 1 !== 0) throw new Error("Invalid base64 input, bad content length.");
		var output;
		if (support.uint8array) output = new Uint8Array(totalLength | 0);
		else output = new Array(totalLength | 0);
		while (i < input.length) {
			enc1 = _keyStr.indexOf(input.charAt(i++));
			enc2 = _keyStr.indexOf(input.charAt(i++));
			enc3 = _keyStr.indexOf(input.charAt(i++));
			enc4 = _keyStr.indexOf(input.charAt(i++));
			chr1 = enc1 << 2 | enc2 >> 4;
			chr2 = (enc2 & 15) << 4 | enc3 >> 2;
			chr3 = (enc3 & 3) << 6 | enc4;
			output[resultIndex++] = chr1;
			if (enc3 !== 64) output[resultIndex++] = chr2;
			if (enc4 !== 64) output[resultIndex++] = chr3;
		}
		return output;
	};
}));
// node_modules/jszip/lib/nodejsUtils.js
var require_nodejsUtils = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		/**
		* True if this is running in Nodejs, will be undefined in a browser.
		* In a browser, browserify won't include this file and the whole module
		* will be resolved an empty object.
		*/
		isNode: typeof Buffer !== "undefined",
		/**
		* Create a new nodejs Buffer from an existing content.
		* @param {Object} data the data to pass to the constructor.
		* @param {String} encoding the encoding to use.
		* @return {Buffer} a new Buffer.
		*/
		newBufferFrom: function(data, encoding) {
			if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(data, encoding);
			else {
				if (typeof data === "number") throw new Error("The \"data\" argument must not be a number");
				return new Buffer(data, encoding);
			}
		},
		/**
		* Create a new nodejs Buffer with the specified size.
		* @param {Integer} size the size of the buffer.
		* @return {Buffer} a new Buffer.
		*/
		allocBuffer: function(size) {
			if (Buffer.alloc) return Buffer.alloc(size);
			else {
				var buf = new Buffer(size);
				buf.fill(0);
				return buf;
			}
		},
		/**
		* Find out if an object is a Buffer.
		* @param {Object} b the object to test.
		* @return {Boolean} true if the object is a Buffer, false otherwise.
		*/
		isBuffer: function(b) {
			return Buffer.isBuffer(b);
		},
		isStream: function(obj) {
			return obj && typeof obj.on === "function" && typeof obj.pause === "function" && typeof obj.resume === "function";
		}
	};
}));
// node_modules/immediate/lib/index.js
var require_lib$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Mutation = global.MutationObserver || global.WebKitMutationObserver;
	var scheduleDrain;
	if (process.browser) {
		if (Mutation) {
			var called = 0;
			var observer = new Mutation(nextTick);
			var element = global.document.createTextNode("");
			observer.observe(element, { characterData: true });
			scheduleDrain = function() {
				element.data = called = ++called % 2;
			};
		} else if (!global.setImmediate && typeof global.MessageChannel !== "undefined") {
			var channel = new global.MessageChannel();
			channel.port1.onmessage = nextTick;
			scheduleDrain = function() {
				channel.port2.postMessage(0);
			};
		} else if ("document" in global && "onreadystatechange" in global.document.createElement("script")) scheduleDrain = function() {
			var scriptEl = global.document.createElement("script");
			scriptEl.onreadystatechange = function() {
				nextTick();
				scriptEl.onreadystatechange = null;
				scriptEl.parentNode.removeChild(scriptEl);
				scriptEl = null;
			};
			global.document.documentElement.appendChild(scriptEl);
		};
		else scheduleDrain = function() {
			setTimeout(nextTick, 0);
		};
	} else scheduleDrain = function() {
		process.nextTick(nextTick);
	};
	var draining;
	var queue = [];
	function nextTick() {
		draining = true;
		var i, oldQueue;
		var len = queue.length;
		while (len) {
			oldQueue = queue;
			queue = [];
			i = -1;
			while (++i < len) oldQueue[i]();
			len = queue.length;
		}
		draining = false;
	}
	module.exports = immediate;
	function immediate(task) {
		if (queue.push(task) === 1 && !draining) scheduleDrain();
	}
}));
// node_modules/lie/lib/index.js
var require_lib$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var immediate = require_lib$2();
	/* istanbul ignore next */
	function INTERNAL() {}
	var handlers = {};
	var REJECTED = ["REJECTED"];
	var FULFILLED = ["FULFILLED"];
	var PENDING = ["PENDING"];
	/* istanbul ignore else */
	if (!process.browser) var UNHANDLED = ["UNHANDLED"];
	module.exports = Promise;
	function Promise(resolver) {
		if (typeof resolver !== "function") throw new TypeError("resolver must be a function");
		this.state = PENDING;
		this.queue = [];
		this.outcome = void 0;
		/* istanbul ignore else */
		if (!process.browser) this.handled = UNHANDLED;
		if (resolver !== INTERNAL) safelyResolveThenable(this, resolver);
	}
	Promise.prototype.finally = function(callback) {
		if (typeof callback !== "function") return this;
		var p = this.constructor;
		return this.then(resolve, reject);
		function resolve(value) {
			function yes() {
				return value;
			}
			return p.resolve(callback()).then(yes);
		}
		function reject(reason) {
			function no() {
				throw reason;
			}
			return p.resolve(callback()).then(no);
		}
	};
	Promise.prototype.catch = function(onRejected) {
		return this.then(null, onRejected);
	};
	Promise.prototype.then = function(onFulfilled, onRejected) {
		if (typeof onFulfilled !== "function" && this.state === FULFILLED || typeof onRejected !== "function" && this.state === REJECTED) return this;
		var promise = new this.constructor(INTERNAL);
		/* istanbul ignore else */
		if (!process.browser) {
			if (this.handled === UNHANDLED) this.handled = null;
		}
		if (this.state !== PENDING) unwrap(promise, this.state === FULFILLED ? onFulfilled : onRejected, this.outcome);
		else this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
		return promise;
	};
	function QueueItem(promise, onFulfilled, onRejected) {
		this.promise = promise;
		if (typeof onFulfilled === "function") {
			this.onFulfilled = onFulfilled;
			this.callFulfilled = this.otherCallFulfilled;
		}
		if (typeof onRejected === "function") {
			this.onRejected = onRejected;
			this.callRejected = this.otherCallRejected;
		}
	}
	QueueItem.prototype.callFulfilled = function(value) {
		handlers.resolve(this.promise, value);
	};
	QueueItem.prototype.otherCallFulfilled = function(value) {
		unwrap(this.promise, this.onFulfilled, value);
	};
	QueueItem.prototype.callRejected = function(value) {
		handlers.reject(this.promise, value);
	};
	QueueItem.prototype.otherCallRejected = function(value) {
		unwrap(this.promise, this.onRejected, value);
	};
	function unwrap(promise, func, value) {
		immediate(function() {
			var returnValue;
			try {
				returnValue = func(value);
			} catch (e) {
				return handlers.reject(promise, e);
			}
			if (returnValue === promise) handlers.reject(promise, /* @__PURE__ */ new TypeError("Cannot resolve promise with itself"));
			else handlers.resolve(promise, returnValue);
		});
	}
	handlers.resolve = function(self, value) {
		var result = tryCatch(getThen, value);
		if (result.status === "error") return handlers.reject(self, result.value);
		var thenable = result.value;
		if (thenable) safelyResolveThenable(self, thenable);
		else {
			self.state = FULFILLED;
			self.outcome = value;
			var i = -1;
			var len = self.queue.length;
			while (++i < len) self.queue[i].callFulfilled(value);
		}
		return self;
	};
	handlers.reject = function(self, error) {
		self.state = REJECTED;
		self.outcome = error;
		/* istanbul ignore else */
		if (!process.browser) {
			if (self.handled === UNHANDLED) immediate(function() {
				if (self.handled === UNHANDLED) process.emit("unhandledRejection", error, self);
			});
		}
		var i = -1;
		var len = self.queue.length;
		while (++i < len) self.queue[i].callRejected(error);
		return self;
	};
	function getThen(obj) {
		var then = obj && obj.then;
		if (obj && (typeof obj === "object" || typeof obj === "function") && typeof then === "function") return function appyThen() {
			then.apply(obj, arguments);
		};
	}
	function safelyResolveThenable(self, thenable) {
		var called = false;
		function onError(value) {
			if (called) return;
			called = true;
			handlers.reject(self, value);
		}
		function onSuccess(value) {
			if (called) return;
			called = true;
			handlers.resolve(self, value);
		}
		function tryToUnwrap() {
			thenable(onSuccess, onError);
		}
		var result = tryCatch(tryToUnwrap);
		if (result.status === "error") onError(result.value);
	}
	function tryCatch(func, value) {
		var out = {};
		try {
			out.value = func(value);
			out.status = "success";
		} catch (e) {
			out.status = "error";
			out.value = e;
		}
		return out;
	}
	Promise.resolve = resolve;
	function resolve(value) {
		if (value instanceof this) return value;
		return handlers.resolve(new this(INTERNAL), value);
	}
	Promise.reject = reject;
	function reject(reason) {
		var promise = new this(INTERNAL);
		return handlers.reject(promise, reason);
	}
	Promise.all = all;
	function all(iterable) {
		var self = this;
		if (Object.prototype.toString.call(iterable) !== "[object Array]") return this.reject(/* @__PURE__ */ new TypeError("must be an array"));
		var len = iterable.length;
		var called = false;
		if (!len) return this.resolve([]);
		var values = new Array(len);
		var resolved = 0;
		var i = -1;
		var promise = new this(INTERNAL);
		while (++i < len) allResolver(iterable[i], i);
		return promise;
		function allResolver(value, i) {
			self.resolve(value).then(resolveFromAll, function(error) {
				if (!called) {
					called = true;
					handlers.reject(promise, error);
				}
			});
			function resolveFromAll(outValue) {
				values[i] = outValue;
				if (++resolved === len && !called) {
					called = true;
					handlers.resolve(promise, values);
				}
			}
		}
	}
	Promise.race = race;
	function race(iterable) {
		var self = this;
		if (Object.prototype.toString.call(iterable) !== "[object Array]") return this.reject(/* @__PURE__ */ new TypeError("must be an array"));
		var len = iterable.length;
		var called = false;
		if (!len) return this.resolve([]);
		var i = -1;
		var promise = new this(INTERNAL);
		while (++i < len) resolver(iterable[i]);
		return promise;
		function resolver(value) {
			self.resolve(value).then(function(response) {
				if (!called) {
					called = true;
					handlers.resolve(promise, response);
				}
			}, function(error) {
				if (!called) {
					called = true;
					handlers.reject(promise, error);
				}
			});
		}
	}
}));
// node_modules/jszip/lib/external.js
var require_external = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ES6Promise = null;
	if (typeof Promise !== "undefined") ES6Promise = Promise;
	else ES6Promise = require_lib$1();
	/**
	* Let the user use/change some implementations.
	*/
	module.exports = { Promise: ES6Promise };
}));
// node_modules/setimmediate/setImmediate.js
var require_setImmediate = /* @__PURE__ */ __commonJSMin((() => {
	(function(global, undefined) {
		"use strict";
		if (global.setImmediate) return;
		var nextHandle = 1;
		var tasksByHandle = {};
		var currentlyRunningATask = false;
		var doc = global.document;
		var registerImmediate;
		function setImmediate(callback) {
			if (typeof callback !== "function") callback = new Function("" + callback);
			var args = new Array(arguments.length - 1);
			for (var i = 0; i < args.length; i++) args[i] = arguments[i + 1];
			tasksByHandle[nextHandle] = {
				callback,
				args
			};
			registerImmediate(nextHandle);
			return nextHandle++;
		}
		function clearImmediate(handle) {
			delete tasksByHandle[handle];
		}
		function run(task) {
			var callback = task.callback;
			var args = task.args;
			switch (args.length) {
				case 0:
					callback();
					break;
				case 1:
					callback(args[0]);
					break;
				case 2:
					callback(args[0], args[1]);
					break;
				case 3:
					callback(args[0], args[1], args[2]);
					break;
				default: callback.apply(undefined, args);
			}
		}
		function runIfPresent(handle) {
			if (currentlyRunningATask) setTimeout(runIfPresent, 0, handle);
			else {
				var task = tasksByHandle[handle];
				if (task) {
					currentlyRunningATask = true;
					try {
						run(task);
					} finally {
						clearImmediate(handle);
						currentlyRunningATask = false;
					}
				}
			}
		}
		function installNextTickImplementation() {
			registerImmediate = function(handle) {
				process.nextTick(function() {
					runIfPresent(handle);
				});
			};
		}
		function canUsePostMessage() {
			if (global.postMessage && !global.importScripts) {
				var postMessageIsAsynchronous = true;
				var oldOnMessage = global.onmessage;
				global.onmessage = function() {
					postMessageIsAsynchronous = false;
				};
				global.postMessage("", "*");
				global.onmessage = oldOnMessage;
				return postMessageIsAsynchronous;
			}
		}
		function installPostMessageImplementation() {
			var messagePrefix = "setImmediate$" + Math.random() + "$";
			var onGlobalMessage = function(event) {
				if (event.source === global && typeof event.data === "string" && event.data.indexOf(messagePrefix) === 0) runIfPresent(+event.data.slice(messagePrefix.length));
			};
			if (global.addEventListener) global.addEventListener("message", onGlobalMessage, false);
			else global.attachEvent("onmessage", onGlobalMessage);
			registerImmediate = function(handle) {
				global.postMessage(messagePrefix + handle, "*");
			};
		}
		function installMessageChannelImplementation() {
			var channel = new MessageChannel();
			channel.port1.onmessage = function(event) {
				var handle = event.data;
				runIfPresent(handle);
			};
			registerImmediate = function(handle) {
				channel.port2.postMessage(handle);
			};
		}
		function installReadyStateChangeImplementation() {
			var html = doc.documentElement;
			registerImmediate = function(handle) {
				var script = doc.createElement("script");
				script.onreadystatechange = function() {
					runIfPresent(handle);
					script.onreadystatechange = null;
					html.removeChild(script);
					script = null;
				};
				html.appendChild(script);
			};
		}
		function installSetTimeoutImplementation() {
			registerImmediate = function(handle) {
				setTimeout(runIfPresent, 0, handle);
			};
		}
		var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
		attachTo = attachTo && attachTo.setTimeout ? attachTo : global;
		if ({}.toString.call(global.process) === "[object process]") installNextTickImplementation();
		else if (canUsePostMessage()) installPostMessageImplementation();
		else if (global.MessageChannel) installMessageChannelImplementation();
		else if (doc && "onreadystatechange" in doc.createElement("script")) installReadyStateChangeImplementation();
		else installSetTimeoutImplementation();
		attachTo.setImmediate = setImmediate;
		attachTo.clearImmediate = clearImmediate;
	})(typeof self === "undefined" ? typeof global === "undefined" ? void 0 : global : self);
}));
// node_modules/jszip/lib/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
	var support = require_support();
	var base64 = require_base64();
	var nodejsUtils = require_nodejsUtils();
	var external = require_external();
	require_setImmediate();
	/**
	* Convert a string that pass as a "binary string": it should represent a byte
	* array but may have > 255 char codes. Be sure to take only the first byte
	* and returns the byte array.
	* @param {String} str the string to transform.
	* @return {Array|Uint8Array} the string in a binary format.
	*/
	function string2binary(str) {
		var result = null;
		if (support.uint8array) result = new Uint8Array(str.length);
		else result = new Array(str.length);
		return stringToArrayLike(str, result);
	}
	/**
	* Create a new blob with the given content and the given type.
	* @param {String|ArrayBuffer} part the content to put in the blob. DO NOT use
	* an Uint8Array because the stock browser of android 4 won't accept it (it
	* will be silently converted to a string, "[object Uint8Array]").
	*
	* Use only ONE part to build the blob to avoid a memory leak in IE11 / Edge:
	* when a large amount of Array is used to create the Blob, the amount of
	* memory consumed is nearly 100 times the original data amount.
	*
	* @param {String} type the mime type of the blob.
	* @return {Blob} the created blob.
	*/
	exports.newBlob = function(part, type) {
		exports.checkSupport("blob");
		try {
			return new Blob([part], { type });
		} catch (e) {
			try {
				var builder = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
				builder.append(part);
				return builder.getBlob(type);
			} catch (e) {
				throw new Error("Bug : can't construct the Blob.");
			}
		}
	};
	/**
	* The identity function.
	* @param {Object} input the input.
	* @return {Object} the same input.
	*/
	function identity(input) {
		return input;
	}
	/**
	* Fill in an array with a string.
	* @param {String} str the string to use.
	* @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to fill in (will be mutated).
	* @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated array.
	*/
	function stringToArrayLike(str, array) {
		for (var i = 0; i < str.length; ++i) array[i] = str.charCodeAt(i) & 255;
		return array;
	}
	/**
	* An helper for the function arrayLikeToString.
	* This contains static information and functions that
	* can be optimized by the browser JIT compiler.
	*/
	var arrayToStringHelper = {
		/**
		* Transform an array of int into a string, chunk by chunk.
		* See the performances notes on arrayLikeToString.
		* @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
		* @param {String} type the type of the array.
		* @param {Integer} chunk the chunk size.
		* @return {String} the resulting string.
		* @throws Error if the chunk is too big for the stack.
		*/
		stringifyByChunk: function(array, type, chunk) {
			var result = [], k = 0, len = array.length;
			if (len <= chunk) return String.fromCharCode.apply(null, array);
			while (k < len) {
				if (type === "array" || type === "nodebuffer") result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len))));
				else result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
				k += chunk;
			}
			return result.join("");
		},
		/**
		* Call String.fromCharCode on every item in the array.
		* This is the naive implementation, which generate A LOT of intermediate string.
		* This should be used when everything else fail.
		* @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
		* @return {String} the result.
		*/
		stringifyByChar: function(array) {
			var resultStr = "";
			for (var i = 0; i < array.length; i++) resultStr += String.fromCharCode(array[i]);
			return resultStr;
		},
		applyCanBeUsed: {
			/**
			* true if the browser accepts to use String.fromCharCode on Uint8Array
			*/
			uint8array: (function() {
				try {
					return support.uint8array && String.fromCharCode.apply(null, /* @__PURE__ */ new Uint8Array(1)).length === 1;
				} catch (e) {
					return false;
				}
			})(),
			/**
			* true if the browser accepts to use String.fromCharCode on nodejs Buffer.
			*/
			nodebuffer: (function() {
				try {
					return support.nodebuffer && String.fromCharCode.apply(null, nodejsUtils.allocBuffer(1)).length === 1;
				} catch (e) {
					return false;
				}
			})()
		}
	};
	/**
	* Transform an array-like object to a string.
	* @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
	* @return {String} the result.
	*/
	function arrayLikeToString(array) {
		var chunk = 65536, type = exports.getTypeOf(array), canUseApply = true;
		if (type === "uint8array") canUseApply = arrayToStringHelper.applyCanBeUsed.uint8array;
		else if (type === "nodebuffer") canUseApply = arrayToStringHelper.applyCanBeUsed.nodebuffer;
		if (canUseApply) while (chunk > 1) try {
			return arrayToStringHelper.stringifyByChunk(array, type, chunk);
		} catch (e) {
			chunk = Math.floor(chunk / 2);
		}
		return arrayToStringHelper.stringifyByChar(array);
	}
	exports.applyFromCharCode = arrayLikeToString;
	/**
	* Copy the data from an array-like to an other array-like.
	* @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayFrom the origin array.
	* @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayTo the destination array which will be mutated.
	* @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated destination array.
	*/
	function arrayLikeToArrayLike(arrayFrom, arrayTo) {
		for (var i = 0; i < arrayFrom.length; i++) arrayTo[i] = arrayFrom[i];
		return arrayTo;
	}
	var transform = {};
	transform["string"] = {
		"string": identity,
		"array": function(input) {
			return stringToArrayLike(input, new Array(input.length));
		},
		"arraybuffer": function(input) {
			return transform["string"]["uint8array"](input).buffer;
		},
		"uint8array": function(input) {
			return stringToArrayLike(input, new Uint8Array(input.length));
		},
		"nodebuffer": function(input) {
			return stringToArrayLike(input, nodejsUtils.allocBuffer(input.length));
		}
	};
	transform["array"] = {
		"string": arrayLikeToString,
		"array": identity,
		"arraybuffer": function(input) {
			return new Uint8Array(input).buffer;
		},
		"uint8array": function(input) {
			return new Uint8Array(input);
		},
		"nodebuffer": function(input) {
			return nodejsUtils.newBufferFrom(input);
		}
	};
	transform["arraybuffer"] = {
		"string": function(input) {
			return arrayLikeToString(new Uint8Array(input));
		},
		"array": function(input) {
			return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
		},
		"arraybuffer": identity,
		"uint8array": function(input) {
			return new Uint8Array(input);
		},
		"nodebuffer": function(input) {
			return nodejsUtils.newBufferFrom(new Uint8Array(input));
		}
	};
	transform["uint8array"] = {
		"string": arrayLikeToString,
		"array": function(input) {
			return arrayLikeToArrayLike(input, new Array(input.length));
		},
		"arraybuffer": function(input) {
			return input.buffer;
		},
		"uint8array": identity,
		"nodebuffer": function(input) {
			return nodejsUtils.newBufferFrom(input);
		}
	};
	transform["nodebuffer"] = {
		"string": arrayLikeToString,
		"array": function(input) {
			return arrayLikeToArrayLike(input, new Array(input.length));
		},
		"arraybuffer": function(input) {
			return transform["nodebuffer"]["uint8array"](input).buffer;
		},
		"uint8array": function(input) {
			return arrayLikeToArrayLike(input, new Uint8Array(input.length));
		},
		"nodebuffer": identity
	};
	/**
	* Transform an input into any type.
	* The supported output type are : string, array, uint8array, arraybuffer, nodebuffer.
	* If no output type is specified, the unmodified input will be returned.
	* @param {String} outputType the output type.
	* @param {String|Array|ArrayBuffer|Uint8Array|Buffer} input the input to convert.
	* @throws {Error} an Error if the browser doesn't support the requested output type.
	*/
	exports.transformTo = function(outputType, input) {
		if (!input) input = "";
		if (!outputType) return input;
		exports.checkSupport(outputType);
		return transform[exports.getTypeOf(input)][outputType](input);
	};
	/**
	* Resolve all relative path components, "." and "..", in a path. If these relative components
	* traverse above the root then the resulting path will only contain the final path component.
	*
	* All empty components, e.g. "//", are removed.
	* @param {string} path A path with / or \ separators
	* @returns {string} The path with all relative path components resolved.
	*/
	exports.resolve = function(path) {
		var parts = path.split("/");
		var result = [];
		for (var index = 0; index < parts.length; index++) {
			var part = parts[index];
			if (part === "." || part === "" && index !== 0 && index !== parts.length - 1) continue;
			else if (part === "..") result.pop();
			else result.push(part);
		}
		return result.join("/");
	};
	/**
	* Return the type of the input.
	* The type will be in a format valid for JSZip.utils.transformTo : string, array, uint8array, arraybuffer.
	* @param {Object} input the input to identify.
	* @return {String} the (lowercase) type of the input.
	*/
	exports.getTypeOf = function(input) {
		if (typeof input === "string") return "string";
		var proto = Object.prototype.toString.call(input);
		if (proto === "[object Array]") return "array";
		if (support.nodebuffer && nodejsUtils.isBuffer(input)) return "nodebuffer";
		if (support.uint8array && proto === "[object Uint8Array]") return "uint8array";
		if (support.arraybuffer && proto === "[object ArrayBuffer]") return "arraybuffer";
	};
	/**
	* Throw an exception if the type is not supported.
	* @param {String} type the type to check.
	* @throws {Error} an Error if the browser doesn't support the requested type.
	*/
	exports.checkSupport = function(type) {
		if (!support[type.toLowerCase()]) throw new Error(type + " is not supported by this platform");
	};
	exports.MAX_VALUE_16BITS = 65535;
	exports.MAX_VALUE_32BITS = -1;
	/**
	* Prettify a string read as binary.
	* @param {string} str the string to prettify.
	* @return {string} a pretty string.
	*/
	exports.pretty = function(str) {
		var res = "", code, i = 0;
		for (; i < (str || "").length; i++) {
			code = str.charCodeAt(i);
			res += "\\x" + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
		}
		return res;
	};
	/**
	* Defer the call of a function.
	* @param {Function} callback the function to call asynchronously.
	* @param {Array} args the arguments to give to the callback.
	*/
	exports.delay = function(callback, args, self) {
		setImmediate(function() {
			callback.apply(self || null, args || []);
		});
	};
	/**
	* Extends a prototype with an other, without calling a constructor with
	* side effects. Inspired by nodejs' `utils.inherits`
	* @param {Function} ctor the constructor to augment
	* @param {Function} superCtor the parent constructor to use
	*/
	exports.inherits = function(ctor, superCtor) {
		var Obj = function() {};
		Obj.prototype = superCtor.prototype;
		ctor.prototype = new Obj();
	};
	/**
	* Merge the objects passed as parameters into a new one.
	* @private
	* @param {...Object} var_args All objects to merge.
	* @return {Object} a new object with the data of the others.
	*/
	exports.extend = function() {
		var result = {}, i = 0, attr;
		for (; i < arguments.length; i++) for (attr in arguments[i]) if (Object.prototype.hasOwnProperty.call(arguments[i], attr) && typeof result[attr] === "undefined") result[attr] = arguments[i][attr];
		return result;
	};
	/**
	* Transform arbitrary content into a Promise.
	* @param {String} name a name for the content being processed.
	* @param {Object} inputData the content to process.
	* @param {Boolean} isBinary true if the content is not an unicode string
	* @param {Boolean} isOptimizedBinaryString true if the string content only has one byte per character.
	* @param {Boolean} isBase64 true if the string content is encoded with base64.
	* @return {Promise} a promise in a format usable by JSZip.
	*/
	exports.prepareContent = function(name, inputData, isBinary, isOptimizedBinaryString, isBase64) {
		return external.Promise.resolve(inputData).then(function(data) {
			if (support.blob && (data instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(data)) !== -1)) {
				if (typeof Blob.prototype.arrayBuffer !== "undefined") return data.arrayBuffer();
				else if (typeof FileReader !== "undefined") return new external.Promise(function(resolve, reject) {
					var reader = new FileReader();
					reader.onload = function(e) {
						resolve(e.target.result);
					};
					reader.onerror = function(e) {
						reject(e.target.error);
					};
					reader.readAsArrayBuffer(data);
				});
				else return external.Promise.reject(/* @__PURE__ */ new Error(name + " is a Blob, but we have no way of reading it."));
			}
			return data;
		}).then(function(data) {
			var dataType = exports.getTypeOf(data);
			if (!dataType) return external.Promise.reject(/* @__PURE__ */ new Error("Can't read the data of '" + name + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
			if (dataType === "arraybuffer") data = exports.transformTo("uint8array", data);
			else if (dataType === "string") {
				if (isBase64) data = base64.decode(data);
				else if (isBinary) {
					if (isOptimizedBinaryString !== true) data = string2binary(data);
				}
			}
			return data;
		});
	};
}));
// node_modules/jszip/lib/stream/GenericWorker.js
var require_GenericWorker = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* A worker that does nothing but passing chunks to the next one. This is like
	* a nodejs stream but with some differences. On the good side :
	* - it works on IE 6-9 without any issue / polyfill
	* - it weights less than the full dependencies bundled with browserify
	* - it forwards errors (no need to declare an error handler EVERYWHERE)
	*
	* A chunk is an object with 2 attributes : `meta` and `data`. The former is an
	* object containing anything (`percent` for example), see each worker for more
	* details. The latter is the real data (String, Uint8Array, etc).
	*
	* @constructor
	* @param {String} name the name of the stream (mainly used for debugging purposes)
	*/
	function GenericWorker(name) {
		this.name = name || "default";
		this.streamInfo = {};
		this.generatedError = null;
		this.extraStreamInfo = {};
		this.isPaused = true;
		this.isFinished = false;
		this.isLocked = false;
		this._listeners = {
			"data": [],
			"end": [],
			"error": []
		};
		this.previous = null;
	}
	GenericWorker.prototype = {
		/**
		* Push a chunk to the next workers.
		* @param {Object} chunk the chunk to push
		*/
		push: function(chunk) {
			this.emit("data", chunk);
		},
		/**
		* End the stream.
		* @return {Boolean} true if this call ended the worker, false otherwise.
		*/
		end: function() {
			if (this.isFinished) return false;
			this.flush();
			try {
				this.emit("end");
				this.cleanUp();
				this.isFinished = true;
			} catch (e) {
				this.emit("error", e);
			}
			return true;
		},
		/**
		* End the stream with an error.
		* @param {Error} e the error which caused the premature end.
		* @return {Boolean} true if this call ended the worker with an error, false otherwise.
		*/
		error: function(e) {
			if (this.isFinished) return false;
			if (this.isPaused) this.generatedError = e;
			else {
				this.isFinished = true;
				this.emit("error", e);
				if (this.previous) this.previous.error(e);
				this.cleanUp();
			}
			return true;
		},
		/**
		* Add a callback on an event.
		* @param {String} name the name of the event (data, end, error)
		* @param {Function} listener the function to call when the event is triggered
		* @return {GenericWorker} the current object for chainability
		*/
		on: function(name, listener) {
			this._listeners[name].push(listener);
			return this;
		},
		/**
		* Clean any references when a worker is ending.
		*/
		cleanUp: function() {
			this.streamInfo = this.generatedError = this.extraStreamInfo = null;
			this._listeners = [];
		},
		/**
		* Trigger an event. This will call registered callback with the provided arg.
		* @param {String} name the name of the event (data, end, error)
		* @param {Object} arg the argument to call the callback with.
		*/
		emit: function(name, arg) {
			if (this._listeners[name]) for (var i = 0; i < this._listeners[name].length; i++) this._listeners[name][i].call(this, arg);
		},
		/**
		* Chain a worker with an other.
		* @param {Worker} next the worker receiving events from the current one.
		* @return {worker} the next worker for chainability
		*/
		pipe: function(next) {
			return next.registerPrevious(this);
		},
		/**
		* Same as `pipe` in the other direction.
		* Using an API with `pipe(next)` is very easy.
		* Implementing the API with the point of view of the next one registering
		* a source is easier, see the ZipFileWorker.
		* @param {Worker} previous the previous worker, sending events to this one
		* @return {Worker} the current worker for chainability
		*/
		registerPrevious: function(previous) {
			if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
			this.streamInfo = previous.streamInfo;
			this.mergeStreamInfo();
			this.previous = previous;
			var self = this;
			previous.on("data", function(chunk) {
				self.processChunk(chunk);
			});
			previous.on("end", function() {
				self.end();
			});
			previous.on("error", function(e) {
				self.error(e);
			});
			return this;
		},
		/**
		* Pause the stream so it doesn't send events anymore.
		* @return {Boolean} true if this call paused the worker, false otherwise.
		*/
		pause: function() {
			if (this.isPaused || this.isFinished) return false;
			this.isPaused = true;
			if (this.previous) this.previous.pause();
			return true;
		},
		/**
		* Resume a paused stream.
		* @return {Boolean} true if this call resumed the worker, false otherwise.
		*/
		resume: function() {
			if (!this.isPaused || this.isFinished) return false;
			this.isPaused = false;
			var withError = false;
			if (this.generatedError) {
				this.error(this.generatedError);
				withError = true;
			}
			if (this.previous) this.previous.resume();
			return !withError;
		},
		/**
		* Flush any remaining bytes as the stream is ending.
		*/
		flush: function() {},
		/**
		* Process a chunk. This is usually the method overridden.
		* @param {Object} chunk the chunk to process.
		*/
		processChunk: function(chunk) {
			this.push(chunk);
		},
		/**
		* Add a key/value to be added in the workers chain streamInfo once activated.
		* @param {String} key the key to use
		* @param {Object} value the associated value
		* @return {Worker} the current worker for chainability
		*/
		withStreamInfo: function(key, value) {
			this.extraStreamInfo[key] = value;
			this.mergeStreamInfo();
			return this;
		},
		/**
		* Merge this worker's streamInfo into the chain's streamInfo.
		*/
		mergeStreamInfo: function() {
			for (var key in this.extraStreamInfo) {
				if (!Object.prototype.hasOwnProperty.call(this.extraStreamInfo, key)) continue;
				this.streamInfo[key] = this.extraStreamInfo[key];
			}
		},
		/**
		* Lock the stream to prevent further updates on the workers chain.
		* After calling this method, all calls to pipe will fail.
		*/
		lock: function() {
			if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
			this.isLocked = true;
			if (this.previous) this.previous.lock();
		},
		/**
		*
		* Pretty print the workers chain.
		*/
		toString: function() {
			var me = "Worker " + this.name;
			if (this.previous) return this.previous + " -> " + me;
			else return me;
		}
	};
	module.exports = GenericWorker;
}));
// node_modules/jszip/lib/utf8.js
var require_utf8 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_utils();
	var support = require_support();
	var nodejsUtils = require_nodejsUtils();
	var GenericWorker = require_GenericWorker();
	/**
	* The following functions come from pako, from pako/lib/utils/strings
	* released under the MIT license, see pako https://github.com/nodeca/pako/
	*/
	var _utf8len = new Array(256);
	for (var i = 0; i < 256; i++) _utf8len[i] = i >= 252 ? 6 : i >= 248 ? 5 : i >= 240 ? 4 : i >= 224 ? 3 : i >= 192 ? 2 : 1;
	_utf8len[254] = _utf8len[254] = 1;
	var string2buf = function(str) {
		var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
		for (m_pos = 0; m_pos < str_len; m_pos++) {
			c = str.charCodeAt(m_pos);
			if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
				c2 = str.charCodeAt(m_pos + 1);
				if ((c2 & 64512) === 56320) {
					c = 65536 + (c - 55296 << 10) + (c2 - 56320);
					m_pos++;
				}
			}
			buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
		}
		if (support.uint8array) buf = new Uint8Array(buf_len);
		else buf = new Array(buf_len);
		for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
			c = str.charCodeAt(m_pos);
			if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
				c2 = str.charCodeAt(m_pos + 1);
				if ((c2 & 64512) === 56320) {
					c = 65536 + (c - 55296 << 10) + (c2 - 56320);
					m_pos++;
				}
			}
			if (c < 128) buf[i++] = c;
			else if (c < 2048) {
				buf[i++] = 192 | c >>> 6;
				buf[i++] = 128 | c & 63;
			} else if (c < 65536) {
				buf[i++] = 224 | c >>> 12;
				buf[i++] = 128 | c >>> 6 & 63;
				buf[i++] = 128 | c & 63;
			} else {
				buf[i++] = 240 | c >>> 18;
				buf[i++] = 128 | c >>> 12 & 63;
				buf[i++] = 128 | c >>> 6 & 63;
				buf[i++] = 128 | c & 63;
			}
		}
		return buf;
	};
	var utf8border = function(buf, max) {
		var pos;
		max = max || buf.length;
		if (max > buf.length) max = buf.length;
		pos = max - 1;
		while (pos >= 0 && (buf[pos] & 192) === 128) pos--;
		if (pos < 0) return max;
		if (pos === 0) return max;
		return pos + _utf8len[buf[pos]] > max ? pos : max;
	};
	var buf2string = function(buf) {
		var i, out, c, c_len;
		var len = buf.length;
		var utf16buf = new Array(len * 2);
		for (out = 0, i = 0; i < len;) {
			c = buf[i++];
			if (c < 128) {
				utf16buf[out++] = c;
				continue;
			}
			c_len = _utf8len[c];
			if (c_len > 4) {
				utf16buf[out++] = 65533;
				i += c_len - 1;
				continue;
			}
			c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
			while (c_len > 1 && i < len) {
				c = c << 6 | buf[i++] & 63;
				c_len--;
			}
			if (c_len > 1) {
				utf16buf[out++] = 65533;
				continue;
			}
			if (c < 65536) utf16buf[out++] = c;
			else {
				c -= 65536;
				utf16buf[out++] = 55296 | c >> 10 & 1023;
				utf16buf[out++] = 56320 | c & 1023;
			}
		}
		if (utf16buf.length !== out) {
			if (utf16buf.subarray) utf16buf = utf16buf.subarray(0, out);
			else utf16buf.length = out;
		}
		return utils.applyFromCharCode(utf16buf);
	};
	/**
	* Transform a javascript string into an array (typed if possible) of bytes,
	* UTF-8 encoded.
	* @param {String} str the string to encode
	* @return {Array|Uint8Array|Buffer} the UTF-8 encoded string.
	*/
	exports.utf8encode = function utf8encode(str) {
		if (support.nodebuffer) return nodejsUtils.newBufferFrom(str, "utf-8");
		return string2buf(str);
	};
	/**
	* Transform a bytes array (or a representation) representing an UTF-8 encoded
	* string into a javascript string.
	* @param {Array|Uint8Array|Buffer} buf the data de decode
	* @return {String} the decoded string.
	*/
	exports.utf8decode = function utf8decode(buf) {
		if (support.nodebuffer) return utils.transformTo("nodebuffer", buf).toString("utf-8");
		buf = utils.transformTo(support.uint8array ? "uint8array" : "array", buf);
		return buf2string(buf);
	};
	/**
	* A worker to decode utf8 encoded binary chunks into string chunks.
	* @constructor
	*/
	function Utf8DecodeWorker() {
		GenericWorker.call(this, "utf-8 decode");
		this.leftOver = null;
	}
	utils.inherits(Utf8DecodeWorker, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	Utf8DecodeWorker.prototype.processChunk = function(chunk) {
		var data = utils.transformTo(support.uint8array ? "uint8array" : "array", chunk.data);
		if (this.leftOver && this.leftOver.length) {
			if (support.uint8array) {
				var previousData = data;
				data = new Uint8Array(previousData.length + this.leftOver.length);
				data.set(this.leftOver, 0);
				data.set(previousData, this.leftOver.length);
			} else data = this.leftOver.concat(data);
			this.leftOver = null;
		}
		var nextBoundary = utf8border(data);
		var usableData = data;
		if (nextBoundary !== data.length) {
			if (support.uint8array) {
				usableData = data.subarray(0, nextBoundary);
				this.leftOver = data.subarray(nextBoundary, data.length);
			} else {
				usableData = data.slice(0, nextBoundary);
				this.leftOver = data.slice(nextBoundary, data.length);
			}
		}
		this.push({
			data: exports.utf8decode(usableData),
			meta: chunk.meta
		});
	};
	/**
	* @see GenericWorker.flush
	*/
	Utf8DecodeWorker.prototype.flush = function() {
		if (this.leftOver && this.leftOver.length) {
			this.push({
				data: exports.utf8decode(this.leftOver),
				meta: {}
			});
			this.leftOver = null;
		}
	};
	exports.Utf8DecodeWorker = Utf8DecodeWorker;
	/**
	* A worker to endcode string chunks into utf8 encoded binary chunks.
	* @constructor
	*/
	function Utf8EncodeWorker() {
		GenericWorker.call(this, "utf-8 encode");
	}
	utils.inherits(Utf8EncodeWorker, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	Utf8EncodeWorker.prototype.processChunk = function(chunk) {
		this.push({
			data: exports.utf8encode(chunk.data),
			meta: chunk.meta
		});
	};
	exports.Utf8EncodeWorker = Utf8EncodeWorker;
}));
// node_modules/jszip/lib/stream/ConvertWorker.js
var require_ConvertWorker = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var GenericWorker = require_GenericWorker();
	var utils = require_utils();
	/**
	* A worker which convert chunks to a specified type.
	* @constructor
	* @param {String} destType the destination type.
	*/
	function ConvertWorker(destType) {
		GenericWorker.call(this, "ConvertWorker to " + destType);
		this.destType = destType;
	}
	utils.inherits(ConvertWorker, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	ConvertWorker.prototype.processChunk = function(chunk) {
		this.push({
			data: utils.transformTo(this.destType, chunk.data),
			meta: chunk.meta
		});
	};
	module.exports = ConvertWorker;
}));
// node_modules/jszip/lib/nodejs/NodejsStreamOutputAdapter.js
var require_NodejsStreamOutputAdapter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Readable = require_readable().Readable;
	require_utils().inherits(NodejsStreamOutputAdapter, Readable);
	/**
	* A nodejs stream using a worker as source.
	* @see the SourceWrapper in http://nodejs.org/api/stream.html
	* @constructor
	* @param {StreamHelper} helper the helper wrapping the worker
	* @param {Object} options the nodejs stream options
	* @param {Function} updateCb the update callback.
	*/
	function NodejsStreamOutputAdapter(helper, options, updateCb) {
		Readable.call(this, options);
		this._helper = helper;
		var self = this;
		helper.on("data", function(data, meta) {
			if (!self.push(data)) self._helper.pause();
			if (updateCb) updateCb(meta);
		}).on("error", function(e) {
			self.emit("error", e);
		}).on("end", function() {
			self.push(null);
		});
	}
	NodejsStreamOutputAdapter.prototype._read = function() {
		this._helper.resume();
	};
	module.exports = NodejsStreamOutputAdapter;
}));
// node_modules/jszip/lib/stream/StreamHelper.js
var require_StreamHelper = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var ConvertWorker = require_ConvertWorker();
	var GenericWorker = require_GenericWorker();
	var base64 = require_base64();
	var support = require_support();
	var external = require_external();
	var NodejsStreamOutputAdapter = null;
	if (support.nodestream) try {
		NodejsStreamOutputAdapter = require_NodejsStreamOutputAdapter();
	} catch (e) {}
	/**
	* Apply the final transformation of the data. If the user wants a Blob for
	* example, it's easier to work with an U8intArray and finally do the
	* ArrayBuffer/Blob conversion.
	* @param {String} type the name of the final type
	* @param {String|Uint8Array|Buffer} content the content to transform
	* @param {String} mimeType the mime type of the content, if applicable.
	* @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the content in the right format.
	*/
	function transformZipOutput(type, content, mimeType) {
		switch (type) {
			case "blob": return utils.newBlob(utils.transformTo("arraybuffer", content), mimeType);
			case "base64": return base64.encode(content);
			default: return utils.transformTo(type, content);
		}
	}
	/**
	* Concatenate an array of data of the given type.
	* @param {String} type the type of the data in the given array.
	* @param {Array} dataArray the array containing the data chunks to concatenate
	* @return {String|Uint8Array|Buffer} the concatenated data
	* @throws Error if the asked type is unsupported
	*/
	function concat(type, dataArray) {
		var i, index = 0, res = null, totalLength = 0;
		for (i = 0; i < dataArray.length; i++) totalLength += dataArray[i].length;
		switch (type) {
			case "string": return dataArray.join("");
			case "array": return Array.prototype.concat.apply([], dataArray);
			case "uint8array":
				res = new Uint8Array(totalLength);
				for (i = 0; i < dataArray.length; i++) {
					res.set(dataArray[i], index);
					index += dataArray[i].length;
				}
				return res;
			case "nodebuffer": return Buffer.concat(dataArray);
			default: throw new Error("concat : unsupported type '" + type + "'");
		}
	}
	/**
	* Listen a StreamHelper, accumulate its content and concatenate it into a
	* complete block.
	* @param {StreamHelper} helper the helper to use.
	* @param {Function} updateCallback a callback called on each update. Called
	* with one arg :
	* - the metadata linked to the update received.
	* @return Promise the promise for the accumulation.
	*/
	function accumulate(helper, updateCallback) {
		return new external.Promise(function(resolve, reject) {
			var dataArray = [];
			var chunkType = helper._internalType, resultType = helper._outputType, mimeType = helper._mimeType;
			helper.on("data", function(data, meta) {
				dataArray.push(data);
				if (updateCallback) updateCallback(meta);
			}).on("error", function(err) {
				dataArray = [];
				reject(err);
			}).on("end", function() {
				try {
					resolve(transformZipOutput(resultType, concat(chunkType, dataArray), mimeType));
				} catch (e) {
					reject(e);
				}
				dataArray = [];
			}).resume();
		});
	}
	/**
	* An helper to easily use workers outside of JSZip.
	* @constructor
	* @param {Worker} worker the worker to wrap
	* @param {String} outputType the type of data expected by the use
	* @param {String} mimeType the mime type of the content, if applicable.
	*/
	function StreamHelper(worker, outputType, mimeType) {
		var internalType = outputType;
		switch (outputType) {
			case "blob":
			case "arraybuffer":
				internalType = "uint8array";
				break;
			case "base64": internalType = "string";
		}
		try {
			this._internalType = internalType;
			this._outputType = outputType;
			this._mimeType = mimeType;
			utils.checkSupport(internalType);
			this._worker = worker.pipe(new ConvertWorker(internalType));
			worker.lock();
		} catch (e) {
			this._worker = new GenericWorker("error");
			this._worker.error(e);
		}
	}
	StreamHelper.prototype = {
		/**
		* Listen a StreamHelper, accumulate its content and concatenate it into a
		* complete block.
		* @param {Function} updateCb the update callback.
		* @return Promise the promise for the accumulation.
		*/
		accumulate: function(updateCb) {
			return accumulate(this, updateCb);
		},
		/**
		* Add a listener on an event triggered on a stream.
		* @param {String} evt the name of the event
		* @param {Function} fn the listener
		* @return {StreamHelper} the current helper.
		*/
		on: function(evt, fn) {
			var self = this;
			if (evt === "data") this._worker.on(evt, function(chunk) {
				fn.call(self, chunk.data, chunk.meta);
			});
			else this._worker.on(evt, function() {
				utils.delay(fn, arguments, self);
			});
			return this;
		},
		/**
		* Resume the flow of chunks.
		* @return {StreamHelper} the current helper.
		*/
		resume: function() {
			utils.delay(this._worker.resume, [], this._worker);
			return this;
		},
		/**
		* Pause the flow of chunks.
		* @return {StreamHelper} the current helper.
		*/
		pause: function() {
			this._worker.pause();
			return this;
		},
		/**
		* Return a nodejs stream for this helper.
		* @param {Function} updateCb the update callback.
		* @return {NodejsStreamOutputAdapter} the nodejs stream.
		*/
		toNodejsStream: function(updateCb) {
			utils.checkSupport("nodestream");
			if (this._outputType !== "nodebuffer") throw new Error(this._outputType + " is not supported by this method");
			return new NodejsStreamOutputAdapter(this, { objectMode: this._outputType !== "nodebuffer" }, updateCb);
		}
	};
	module.exports = StreamHelper;
}));
// node_modules/jszip/lib/defaults.js
var require_defaults = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.base64 = false;
	exports.binary = false;
	exports.dir = false;
	exports.createFolders = true;
	exports.date = null;
	exports.compression = null;
	exports.compressionOptions = null;
	exports.comment = null;
	exports.unixPermissions = null;
	exports.dosPermissions = null;
}));
// node_modules/jszip/lib/stream/DataWorker.js
var require_DataWorker = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	var DEFAULT_BLOCK_SIZE = 16384;
	/**
	* A worker that reads a content and emits chunks.
	* @constructor
	* @param {Promise} dataP the promise of the data to split
	*/
	function DataWorker(dataP) {
		GenericWorker.call(this, "DataWorker");
		var self = this;
		this.dataIsReady = false;
		this.index = 0;
		this.max = 0;
		this.data = null;
		this.type = "";
		this._tickScheduled = false;
		dataP.then(function(data) {
			self.dataIsReady = true;
			self.data = data;
			self.max = data && data.length || 0;
			self.type = utils.getTypeOf(data);
			if (!self.isPaused) self._tickAndRepeat();
		}, function(e) {
			self.error(e);
		});
	}
	utils.inherits(DataWorker, GenericWorker);
	/**
	* @see GenericWorker.cleanUp
	*/
	DataWorker.prototype.cleanUp = function() {
		GenericWorker.prototype.cleanUp.call(this);
		this.data = null;
	};
	/**
	* @see GenericWorker.resume
	*/
	DataWorker.prototype.resume = function() {
		if (!GenericWorker.prototype.resume.call(this)) return false;
		if (!this._tickScheduled && this.dataIsReady) {
			this._tickScheduled = true;
			utils.delay(this._tickAndRepeat, [], this);
		}
		return true;
	};
	/**
	* Trigger a tick a schedule an other call to this function.
	*/
	DataWorker.prototype._tickAndRepeat = function() {
		this._tickScheduled = false;
		if (this.isPaused || this.isFinished) return;
		this._tick();
		if (!this.isFinished) {
			utils.delay(this._tickAndRepeat, [], this);
			this._tickScheduled = true;
		}
	};
	/**
	* Read and push a chunk.
	*/
	DataWorker.prototype._tick = function() {
		if (this.isPaused || this.isFinished) return false;
		var size = DEFAULT_BLOCK_SIZE;
		var data = null, nextIndex = Math.min(this.max, this.index + size);
		if (this.index >= this.max) return this.end();
		else {
			switch (this.type) {
				case "string":
					data = this.data.substring(this.index, nextIndex);
					break;
				case "uint8array":
					data = this.data.subarray(this.index, nextIndex);
					break;
				case "array":
				case "nodebuffer": data = this.data.slice(this.index, nextIndex);
			}
			this.index = nextIndex;
			return this.push({
				data,
				meta: { percent: this.max ? this.index / this.max * 100 : 0 }
			});
		}
	};
	module.exports = DataWorker;
}));
// node_modules/jszip/lib/crc32.js
var require_crc32$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	/**
	* The following functions come from pako, from pako/lib/zlib/crc32.js
	* released under the MIT license, see pako https://github.com/nodeca/pako/
	*/
	function makeTable() {
		var c, table = [];
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
			table[n] = c;
		}
		return table;
	}
	var crcTable = makeTable();
	function crc32(crc, buf, len, pos) {
		var t = crcTable, end = pos + len;
		crc = crc ^ -1;
		for (var i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
		return crc ^ -1;
	}
	/**
	* Compute the crc32 of a string.
	* This is almost the same as the function crc32, but for strings. Using the
	* same function for the two use cases leads to horrible performances.
	* @param {Number} crc the starting value of the crc.
	* @param {String} str the string to use.
	* @param {Number} len the length of the string.
	* @param {Number} pos the starting position for the crc32 computation.
	* @return {Number} the computed crc32.
	*/
	function crc32str(crc, str, len, pos) {
		var t = crcTable, end = pos + len;
		crc = crc ^ -1;
		for (var i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ str.charCodeAt(i)) & 255];
		return crc ^ -1;
	}
	module.exports = function crc32wrapper(input, crc) {
		if (typeof input === "undefined" || !input.length) return 0;
		if (utils.getTypeOf(input) !== "string") return crc32(crc | 0, input, input.length, 0);
		else return crc32str(crc | 0, input, input.length, 0);
	};
}));
// node_modules/jszip/lib/stream/Crc32Probe.js
var require_Crc32Probe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var GenericWorker = require_GenericWorker();
	var crc32 = require_crc32$1();
	var utils = require_utils();
	/**
	* A worker which calculate the crc32 of the data flowing through.
	* @constructor
	*/
	function Crc32Probe() {
		GenericWorker.call(this, "Crc32Probe");
		this.withStreamInfo("crc32", 0);
	}
	utils.inherits(Crc32Probe, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	Crc32Probe.prototype.processChunk = function(chunk) {
		this.streamInfo.crc32 = crc32(chunk.data, this.streamInfo.crc32 || 0);
		this.push(chunk);
	};
	module.exports = Crc32Probe;
}));
// node_modules/jszip/lib/stream/DataLengthProbe.js
var require_DataLengthProbe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	/**
	* A worker which calculate the total length of the data flowing through.
	* @constructor
	* @param {String} propName the name used to expose the length
	*/
	function DataLengthProbe(propName) {
		GenericWorker.call(this, "DataLengthProbe for " + propName);
		this.propName = propName;
		this.withStreamInfo(propName, 0);
	}
	utils.inherits(DataLengthProbe, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	DataLengthProbe.prototype.processChunk = function(chunk) {
		if (chunk) {
			var length = this.streamInfo[this.propName] || 0;
			this.streamInfo[this.propName] = length + chunk.data.length;
		}
		GenericWorker.prototype.processChunk.call(this, chunk);
	};
	module.exports = DataLengthProbe;
}));
// node_modules/jszip/lib/compressedObject.js
var require_compressedObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var external = require_external();
	var DataWorker = require_DataWorker();
	var Crc32Probe = require_Crc32Probe();
	var DataLengthProbe = require_DataLengthProbe();
	/**
	* Represent a compressed object, with everything needed to decompress it.
	* @constructor
	* @param {number} compressedSize the size of the data compressed.
	* @param {number} uncompressedSize the size of the data after decompression.
	* @param {number} crc32 the crc32 of the decompressed file.
	* @param {object} compression the type of compression, see lib/compressions.js.
	* @param {String|ArrayBuffer|Uint8Array|Buffer} data the compressed data.
	*/
	function CompressedObject(compressedSize, uncompressedSize, crc32, compression, data) {
		this.compressedSize = compressedSize;
		this.uncompressedSize = uncompressedSize;
		this.crc32 = crc32;
		this.compression = compression;
		this.compressedContent = data;
	}
	CompressedObject.prototype = {
		/**
		* Create a worker to get the uncompressed content.
		* @return {GenericWorker} the worker.
		*/
		getContentWorker: function() {
			var worker = new DataWorker(external.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new DataLengthProbe("data_length"));
			var that = this;
			worker.on("end", function() {
				if (this.streamInfo["data_length"] !== that.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
			});
			return worker;
		},
		/**
		* Create a worker to get the compressed content.
		* @return {GenericWorker} the worker.
		*/
		getCompressedWorker: function() {
			return new DataWorker(external.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
		}
	};
	/**
	* Chain the given worker with other workers to compress the content with the
	* given compression.
	* @param {GenericWorker} uncompressedWorker the worker to pipe.
	* @param {Object} compression the compression object.
	* @param {Object} compressionOptions the options to use when compressing.
	* @return {GenericWorker} the new worker compressing the content.
	*/
	CompressedObject.createWorkerFrom = function(uncompressedWorker, compression, compressionOptions) {
		return uncompressedWorker.pipe(new Crc32Probe()).pipe(new DataLengthProbe("uncompressedSize")).pipe(compression.compressWorker(compressionOptions)).pipe(new DataLengthProbe("compressedSize")).withStreamInfo("compression", compression);
	};
	module.exports = CompressedObject;
}));
// node_modules/jszip/lib/zipObject.js
var require_zipObject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var StreamHelper = require_StreamHelper();
	var DataWorker = require_DataWorker();
	var utf8 = require_utf8();
	var CompressedObject = require_compressedObject();
	var GenericWorker = require_GenericWorker();
	/**
	* A simple object representing a file in the zip file.
	* @constructor
	* @param {string} name the name of the file
	* @param {String|ArrayBuffer|Uint8Array|Buffer} data the data
	* @param {Object} options the options of the file
	*/
	var ZipObject = function(name, data, options) {
		this.name = name;
		this.dir = options.dir;
		this.date = options.date;
		this.comment = options.comment;
		this.unixPermissions = options.unixPermissions;
		this.dosPermissions = options.dosPermissions;
		this._data = data;
		this._dataBinary = options.binary;
		this.options = {
			compression: options.compression,
			compressionOptions: options.compressionOptions
		};
	};
	ZipObject.prototype = {
		/**
		* Create an internal stream for the content of this object.
		* @param {String} type the type of each chunk.
		* @return StreamHelper the stream.
		*/
		internalStream: function(type) {
			var result = null, outputType = "string";
			try {
				if (!type) throw new Error("No output type specified.");
				outputType = type.toLowerCase();
				var askUnicodeString = outputType === "string" || outputType === "text";
				if (outputType === "binarystring" || outputType === "text") outputType = "string";
				result = this._decompressWorker();
				var isUnicodeString = !this._dataBinary;
				if (isUnicodeString && !askUnicodeString) result = result.pipe(new utf8.Utf8EncodeWorker());
				if (!isUnicodeString && askUnicodeString) result = result.pipe(new utf8.Utf8DecodeWorker());
			} catch (e) {
				result = new GenericWorker("error");
				result.error(e);
			}
			return new StreamHelper(result, outputType, "");
		},
		/**
		* Prepare the content in the asked type.
		* @param {String} type the type of the result.
		* @param {Function} onUpdate a function to call on each internal update.
		* @return Promise the promise of the result.
		*/
		async: function(type, onUpdate) {
			return this.internalStream(type).accumulate(onUpdate);
		},
		/**
		* Prepare the content as a nodejs stream.
		* @param {String} type the type of each chunk.
		* @param {Function} onUpdate a function to call on each internal update.
		* @return Stream the stream.
		*/
		nodeStream: function(type, onUpdate) {
			return this.internalStream(type || "nodebuffer").toNodejsStream(onUpdate);
		},
		/**
		* Return a worker for the compressed content.
		* @private
		* @param {Object} compression the compression object to use.
		* @param {Object} compressionOptions the options to use when compressing.
		* @return Worker the worker.
		*/
		_compressWorker: function(compression, compressionOptions) {
			if (this._data instanceof CompressedObject && this._data.compression.magic === compression.magic) return this._data.getCompressedWorker();
			else {
				var result = this._decompressWorker();
				if (!this._dataBinary) result = result.pipe(new utf8.Utf8EncodeWorker());
				return CompressedObject.createWorkerFrom(result, compression, compressionOptions);
			}
		},
		/**
		* Return a worker for the decompressed content.
		* @private
		* @return Worker the worker.
		*/
		_decompressWorker: function() {
			if (this._data instanceof CompressedObject) return this._data.getContentWorker();
			else if (this._data instanceof GenericWorker) return this._data;
			else return new DataWorker(this._data);
		}
	};
	var removedMethods = [
		"asText",
		"asBinary",
		"asNodeBuffer",
		"asUint8Array",
		"asArrayBuffer"
	];
	var removedFn = function() {
		throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
	};
	for (var i = 0; i < removedMethods.length; i++) ZipObject.prototype[removedMethods[i]] = removedFn;
	module.exports = ZipObject;
}));
// node_modules/pako/lib/utils/common.js
var require_common = /* @__PURE__ */ __commonJSMin(((exports) => {
	var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
	function _has(obj, key) {
		return Object.prototype.hasOwnProperty.call(obj, key);
	}
	exports.assign = function(obj) {
		var sources = Array.prototype.slice.call(arguments, 1);
		while (sources.length) {
			var source = sources.shift();
			if (!source) continue;
			if (typeof source !== "object") throw new TypeError(source + "must be non-object");
			for (var p in source) if (_has(source, p)) obj[p] = source[p];
		}
		return obj;
	};
	exports.shrinkBuf = function(buf, size) {
		if (buf.length === size) return buf;
		if (buf.subarray) return buf.subarray(0, size);
		buf.length = size;
		return buf;
	};
	var fnTyped = {
		arraySet: function(dest, src, src_offs, len, dest_offs) {
			if (src.subarray && dest.subarray) {
				dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
				return;
			}
			for (var i = 0; i < len; i++) dest[dest_offs + i] = src[src_offs + i];
		},
		flattenChunks: function(chunks) {
			var i, l, len = 0, pos, chunk, result;
			for (i = 0, l = chunks.length; i < l; i++) len += chunks[i].length;
			result = new Uint8Array(len);
			pos = 0;
			for (i = 0, l = chunks.length; i < l; i++) {
				chunk = chunks[i];
				result.set(chunk, pos);
				pos += chunk.length;
			}
			return result;
		}
	};
	var fnUntyped = {
		arraySet: function(dest, src, src_offs, len, dest_offs) {
			for (var i = 0; i < len; i++) dest[dest_offs + i] = src[src_offs + i];
		},
		flattenChunks: function(chunks) {
			return [].concat.apply([], chunks);
		}
	};
	exports.setTyped = function(on) {
		if (on) {
			exports.Buf8 = Uint8Array;
			exports.Buf16 = Uint16Array;
			exports.Buf32 = Int32Array;
			exports.assign(exports, fnTyped);
		} else {
			exports.Buf8 = Array;
			exports.Buf16 = Array;
			exports.Buf32 = Array;
			exports.assign(exports, fnUntyped);
		}
	};
	exports.setTyped(TYPED_OK);
}));
// node_modules/pako/lib/zlib/trees.js
var require_trees = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_common();
	var Z_FIXED = 4;
	var Z_BINARY = 0;
	var Z_TEXT = 1;
	var Z_UNKNOWN = 2;
	function zero(buf) {
		var len = buf.length;
		while (--len >= 0) buf[len] = 0;
	}
	var STORED_BLOCK = 0;
	var STATIC_TREES = 1;
	var DYN_TREES = 2;
	var MIN_MATCH = 3;
	var MAX_MATCH = 258;
	var LENGTH_CODES = 29;
	var LITERALS = 256;
	var L_CODES = LITERALS + 1 + LENGTH_CODES;
	var D_CODES = 30;
	var BL_CODES = 19;
	var HEAP_SIZE = 2 * L_CODES + 1;
	var MAX_BITS = 15;
	var Buf_size = 16;
	var MAX_BL_BITS = 7;
	var END_BLOCK = 256;
	var REP_3_6 = 16;
	var REPZ_3_10 = 17;
	var REPZ_11_138 = 18;
	var extra_lbits = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		2,
		2,
		2,
		2,
		3,
		3,
		3,
		3,
		4,
		4,
		4,
		4,
		5,
		5,
		5,
		5,
		0
	];
	var extra_dbits = [
		0,
		0,
		0,
		0,
		1,
		1,
		2,
		2,
		3,
		3,
		4,
		4,
		5,
		5,
		6,
		6,
		7,
		7,
		8,
		8,
		9,
		9,
		10,
		10,
		11,
		11,
		12,
		12,
		13,
		13
	];
	var extra_blbits = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		2,
		3,
		7
	];
	var bl_order = [
		16,
		17,
		18,
		0,
		8,
		7,
		9,
		6,
		10,
		5,
		11,
		4,
		12,
		3,
		13,
		2,
		14,
		1,
		15
	];
	var DIST_CODE_LEN = 512;
	var static_ltree = new Array((L_CODES + 2) * 2);
	zero(static_ltree);
	var static_dtree = new Array(D_CODES * 2);
	zero(static_dtree);
	var _dist_code = new Array(DIST_CODE_LEN);
	zero(_dist_code);
	var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
	zero(_length_code);
	var base_length = new Array(LENGTH_CODES);
	zero(base_length);
	var base_dist = new Array(D_CODES);
	zero(base_dist);
	function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
		this.static_tree = static_tree;
		this.extra_bits = extra_bits;
		this.extra_base = extra_base;
		this.elems = elems;
		this.max_length = max_length;
		this.has_stree = static_tree && static_tree.length;
	}
	var static_l_desc;
	var static_d_desc;
	var static_bl_desc;
	function TreeDesc(dyn_tree, stat_desc) {
		this.dyn_tree = dyn_tree;
		this.max_code = 0;
		this.stat_desc = stat_desc;
	}
	function d_code(dist) {
		return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
	}
	function put_short(s, w) {
		s.pending_buf[s.pending++] = w & 255;
		s.pending_buf[s.pending++] = w >>> 8 & 255;
	}
	function send_bits(s, value, length) {
		if (s.bi_valid > Buf_size - length) {
			s.bi_buf |= value << s.bi_valid & 65535;
			put_short(s, s.bi_buf);
			s.bi_buf = value >> Buf_size - s.bi_valid;
			s.bi_valid += length - Buf_size;
		} else {
			s.bi_buf |= value << s.bi_valid & 65535;
			s.bi_valid += length;
		}
	}
	function send_code(s, c, tree) {
		send_bits(s, tree[c * 2], tree[c * 2 + 1]);
	}
	function bi_reverse(code, len) {
		var res = 0;
		do {
			res |= code & 1;
			code >>>= 1;
			res <<= 1;
		} while (--len > 0);
		return res >>> 1;
	}
	function bi_flush(s) {
		if (s.bi_valid === 16) {
			put_short(s, s.bi_buf);
			s.bi_buf = 0;
			s.bi_valid = 0;
		} else if (s.bi_valid >= 8) {
			s.pending_buf[s.pending++] = s.bi_buf & 255;
			s.bi_buf >>= 8;
			s.bi_valid -= 8;
		}
	}
	function gen_bitlen(s, desc) {
		var tree = desc.dyn_tree;
		var max_code = desc.max_code;
		var stree = desc.stat_desc.static_tree;
		var has_stree = desc.stat_desc.has_stree;
		var extra = desc.stat_desc.extra_bits;
		var base = desc.stat_desc.extra_base;
		var max_length = desc.stat_desc.max_length;
		var h;
		var n, m;
		var bits;
		var xbits;
		var f;
		var overflow = 0;
		for (bits = 0; bits <= MAX_BITS; bits++) s.bl_count[bits] = 0;
		tree[s.heap[s.heap_max] * 2 + 1] = 0;
		for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
			n = s.heap[h];
			bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
			if (bits > max_length) {
				bits = max_length;
				overflow++;
			}
			tree[n * 2 + 1] = bits;
			if (n > max_code) continue;
			s.bl_count[bits]++;
			xbits = 0;
			if (n >= base) xbits = extra[n - base];
			f = tree[n * 2];
			s.opt_len += f * (bits + xbits);
			if (has_stree) s.static_len += f * (stree[n * 2 + 1] + xbits);
		}
		if (overflow === 0) return;
		do {
			bits = max_length - 1;
			while (s.bl_count[bits] === 0) bits--;
			s.bl_count[bits]--;
			s.bl_count[bits + 1] += 2;
			s.bl_count[max_length]--;
			overflow -= 2;
		} while (overflow > 0);
		for (bits = max_length; bits !== 0; bits--) {
			n = s.bl_count[bits];
			while (n !== 0) {
				m = s.heap[--h];
				if (m > max_code) continue;
				if (tree[m * 2 + 1] !== bits) {
					s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
					tree[m * 2 + 1] = bits;
				}
				n--;
			}
		}
	}
	function gen_codes(tree, max_code, bl_count) {
		var next_code = new Array(MAX_BITS + 1);
		var code = 0;
		var bits;
		var n;
		for (bits = 1; bits <= MAX_BITS; bits++) next_code[bits] = code = code + bl_count[bits - 1] << 1;
		for (n = 0; n <= max_code; n++) {
			var len = tree[n * 2 + 1];
			if (len === 0) continue;
			tree[n * 2] = bi_reverse(next_code[len]++, len);
		}
	}
	function tr_static_init() {
		var n;
		var bits;
		var length;
		var code;
		var dist;
		var bl_count = new Array(MAX_BITS + 1);
		length = 0;
		for (code = 0; code < LENGTH_CODES - 1; code++) {
			base_length[code] = length;
			for (n = 0; n < 1 << extra_lbits[code]; n++) _length_code[length++] = code;
		}
		_length_code[length - 1] = code;
		dist = 0;
		for (code = 0; code < 16; code++) {
			base_dist[code] = dist;
			for (n = 0; n < 1 << extra_dbits[code]; n++) _dist_code[dist++] = code;
		}
		dist >>= 7;
		for (; code < D_CODES; code++) {
			base_dist[code] = dist << 7;
			for (n = 0; n < 1 << extra_dbits[code] - 7; n++) _dist_code[256 + dist++] = code;
		}
		for (bits = 0; bits <= MAX_BITS; bits++) bl_count[bits] = 0;
		n = 0;
		while (n <= 143) {
			static_ltree[n * 2 + 1] = 8;
			n++;
			bl_count[8]++;
		}
		while (n <= 255) {
			static_ltree[n * 2 + 1] = 9;
			n++;
			bl_count[9]++;
		}
		while (n <= 279) {
			static_ltree[n * 2 + 1] = 7;
			n++;
			bl_count[7]++;
		}
		while (n <= 287) {
			static_ltree[n * 2 + 1] = 8;
			n++;
			bl_count[8]++;
		}
		gen_codes(static_ltree, L_CODES + 1, bl_count);
		for (n = 0; n < D_CODES; n++) {
			static_dtree[n * 2 + 1] = 5;
			static_dtree[n * 2] = bi_reverse(n, 5);
		}
		static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
		static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
		static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
	}
	function init_block(s) {
		var n = 0;
		for (; n < L_CODES; n++) s.dyn_ltree[n * 2] = 0;
		for (n = 0; n < D_CODES; n++) s.dyn_dtree[n * 2] = 0;
		for (n = 0; n < BL_CODES; n++) s.bl_tree[n * 2] = 0;
		s.dyn_ltree[END_BLOCK * 2] = 1;
		s.opt_len = s.static_len = 0;
		s.last_lit = s.matches = 0;
	}
	function bi_windup(s) {
		if (s.bi_valid > 8) put_short(s, s.bi_buf);
		else if (s.bi_valid > 0) s.pending_buf[s.pending++] = s.bi_buf;
		s.bi_buf = 0;
		s.bi_valid = 0;
	}
	function copy_block(s, buf, len, header) {
		bi_windup(s);
		if (header) {
			put_short(s, len);
			put_short(s, ~len);
		}
		utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
		s.pending += len;
	}
	function smaller(tree, n, m, depth) {
		var _n2 = n * 2;
		var _m2 = m * 2;
		return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
	}
	function pqdownheap(s, tree, k) {
		var v = s.heap[k];
		var j = k << 1;
		while (j <= s.heap_len) {
			if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) j++;
			if (smaller(tree, v, s.heap[j], s.depth)) break;
			s.heap[k] = s.heap[j];
			k = j;
			j <<= 1;
		}
		s.heap[k] = v;
	}
	function compress_block(s, ltree, dtree) {
		var dist;
		var lc;
		var lx = 0;
		var code;
		var extra;
		if (s.last_lit !== 0) do {
			dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
			lc = s.pending_buf[s.l_buf + lx];
			lx++;
			if (dist === 0) send_code(s, lc, ltree);
			else {
				code = _length_code[lc];
				send_code(s, code + LITERALS + 1, ltree);
				extra = extra_lbits[code];
				if (extra !== 0) {
					lc -= base_length[code];
					send_bits(s, lc, extra);
				}
				dist--;
				code = d_code(dist);
				send_code(s, code, dtree);
				extra = extra_dbits[code];
				if (extra !== 0) {
					dist -= base_dist[code];
					send_bits(s, dist, extra);
				}
			}
		} while (lx < s.last_lit);
		send_code(s, END_BLOCK, ltree);
	}
	function build_tree(s, desc) {
		var tree = desc.dyn_tree;
		var stree = desc.stat_desc.static_tree;
		var has_stree = desc.stat_desc.has_stree;
		var elems = desc.stat_desc.elems;
		var n, m;
		var max_code = -1;
		var node;
		s.heap_len = 0;
		s.heap_max = HEAP_SIZE;
		for (n = 0; n < elems; n++) if (tree[n * 2] !== 0) {
			s.heap[++s.heap_len] = max_code = n;
			s.depth[n] = 0;
		} else tree[n * 2 + 1] = 0;
		while (s.heap_len < 2) {
			node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
			tree[node * 2] = 1;
			s.depth[node] = 0;
			s.opt_len--;
			if (has_stree) s.static_len -= stree[node * 2 + 1];
		}
		desc.max_code = max_code;
		for (n = s.heap_len >> 1; n >= 1; n--) pqdownheap(s, tree, n);
		node = elems;
		do {
			/*** pqremove ***/
			n = s.heap[1];
			s.heap[1] = s.heap[s.heap_len--];
			pqdownheap(s, tree, 1);
			m = s.heap[1];
			s.heap[--s.heap_max] = n;
			s.heap[--s.heap_max] = m;
			tree[node * 2] = tree[n * 2] + tree[m * 2];
			s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
			tree[n * 2 + 1] = tree[m * 2 + 1] = node;
			s.heap[1] = node++;
			pqdownheap(s, tree, 1);
		} while (s.heap_len >= 2);
		s.heap[--s.heap_max] = s.heap[1];
		gen_bitlen(s, desc);
		gen_codes(tree, max_code, s.bl_count);
	}
	function scan_tree(s, tree, max_code) {
		var n;
		var prevlen = -1;
		var curlen;
		var nextlen = tree[1];
		var count = 0;
		var max_count = 7;
		var min_count = 4;
		if (nextlen === 0) {
			max_count = 138;
			min_count = 3;
		}
		tree[(max_code + 1) * 2 + 1] = 65535;
		for (n = 0; n <= max_code; n++) {
			curlen = nextlen;
			nextlen = tree[(n + 1) * 2 + 1];
			if (++count < max_count && curlen === nextlen) continue;
			else if (count < min_count) s.bl_tree[curlen * 2] += count;
			else if (curlen !== 0) {
				if (curlen !== prevlen) s.bl_tree[curlen * 2]++;
				s.bl_tree[REP_3_6 * 2]++;
			} else if (count <= 10) s.bl_tree[REPZ_3_10 * 2]++;
			else s.bl_tree[REPZ_11_138 * 2]++;
			count = 0;
			prevlen = curlen;
			if (nextlen === 0) {
				max_count = 138;
				min_count = 3;
			} else if (curlen === nextlen) {
				max_count = 6;
				min_count = 3;
			} else {
				max_count = 7;
				min_count = 4;
			}
		}
	}
	function send_tree(s, tree, max_code) {
		var n;
		var prevlen = -1;
		var curlen;
		var nextlen = tree[1];
		var count = 0;
		var max_count = 7;
		var min_count = 4;
		if (nextlen === 0) {
			max_count = 138;
			min_count = 3;
		}
		for (n = 0; n <= max_code; n++) {
			curlen = nextlen;
			nextlen = tree[(n + 1) * 2 + 1];
			if (++count < max_count && curlen === nextlen) continue;
			else if (count < min_count) do
				send_code(s, curlen, s.bl_tree);
			while (--count !== 0);
			else if (curlen !== 0) {
				if (curlen !== prevlen) {
					send_code(s, curlen, s.bl_tree);
					count--;
				}
				send_code(s, REP_3_6, s.bl_tree);
				send_bits(s, count - 3, 2);
			} else if (count <= 10) {
				send_code(s, REPZ_3_10, s.bl_tree);
				send_bits(s, count - 3, 3);
			} else {
				send_code(s, REPZ_11_138, s.bl_tree);
				send_bits(s, count - 11, 7);
			}
			count = 0;
			prevlen = curlen;
			if (nextlen === 0) {
				max_count = 138;
				min_count = 3;
			} else if (curlen === nextlen) {
				max_count = 6;
				min_count = 3;
			} else {
				max_count = 7;
				min_count = 4;
			}
		}
	}
	function build_bl_tree(s) {
		var max_blindex;
		scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
		scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
		build_tree(s, s.bl_desc);
		for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) break;
		s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
		return max_blindex;
	}
	function send_all_trees(s, lcodes, dcodes, blcodes) {
		var rank;
		send_bits(s, lcodes - 257, 5);
		send_bits(s, dcodes - 1, 5);
		send_bits(s, blcodes - 4, 4);
		for (rank = 0; rank < blcodes; rank++) send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
		send_tree(s, s.dyn_ltree, lcodes - 1);
		send_tree(s, s.dyn_dtree, dcodes - 1);
	}
	function detect_data_type(s) {
		var black_mask = 4093624447;
		var n = 0;
		for (; n <= 31; n++, black_mask >>>= 1) if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) return Z_BINARY;
		if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0) return Z_TEXT;
		for (n = 32; n < LITERALS; n++) if (s.dyn_ltree[n * 2] !== 0) return Z_TEXT;
		return Z_BINARY;
	}
	var static_init_done = false;
	function _tr_init(s) {
		if (!static_init_done) {
			tr_static_init();
			static_init_done = true;
		}
		s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
		s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
		s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
		s.bi_buf = 0;
		s.bi_valid = 0;
		init_block(s);
	}
	function _tr_stored_block(s, buf, stored_len, last) {
		send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
		copy_block(s, buf, stored_len, true);
	}
	function _tr_align(s) {
		send_bits(s, STATIC_TREES << 1, 3);
		send_code(s, END_BLOCK, static_ltree);
		bi_flush(s);
	}
	function _tr_flush_block(s, buf, stored_len, last) {
		var opt_lenb, static_lenb;
		var max_blindex = 0;
		if (s.level > 0) {
			if (s.strm.data_type === Z_UNKNOWN) s.strm.data_type = detect_data_type(s);
			build_tree(s, s.l_desc);
			build_tree(s, s.d_desc);
			max_blindex = build_bl_tree(s);
			opt_lenb = s.opt_len + 3 + 7 >>> 3;
			static_lenb = s.static_len + 3 + 7 >>> 3;
			if (static_lenb <= opt_lenb) opt_lenb = static_lenb;
		} else opt_lenb = static_lenb = stored_len + 5;
		if (stored_len + 4 <= opt_lenb && buf !== -1) _tr_stored_block(s, buf, stored_len, last);
		else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
			send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
			compress_block(s, static_ltree, static_dtree);
		} else {
			send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
			send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
			compress_block(s, s.dyn_ltree, s.dyn_dtree);
		}
		init_block(s);
		if (last) bi_windup(s);
	}
	function _tr_tally(s, dist, lc) {
		s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
		s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
		s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
		s.last_lit++;
		if (dist === 0) s.dyn_ltree[lc * 2]++;
		else {
			s.matches++;
			dist--;
			s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
			s.dyn_dtree[d_code(dist) * 2]++;
		}
		return s.last_lit === s.lit_bufsize - 1;
	}
	exports._tr_init = _tr_init;
	exports._tr_stored_block = _tr_stored_block;
	exports._tr_flush_block = _tr_flush_block;
	exports._tr_tally = _tr_tally;
	exports._tr_align = _tr_align;
}));
// node_modules/pako/lib/zlib/adler32.js
var require_adler32 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function adler32(adler, buf, len, pos) {
		var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
		while (len !== 0) {
			n = len > 2e3 ? 2e3 : len;
			len -= n;
			do {
				s1 = s1 + buf[pos++] | 0;
				s2 = s2 + s1 | 0;
			} while (--n);
			s1 %= 65521;
			s2 %= 65521;
		}
		return s1 | s2 << 16 | 0;
	}
	module.exports = adler32;
}));
// node_modules/pako/lib/zlib/crc32.js
var require_crc32 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function makeTable() {
		var c, table = [];
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
			table[n] = c;
		}
		return table;
	}
	var crcTable = makeTable();
	function crc32(crc, buf, len, pos) {
		var t = crcTable, end = pos + len;
		crc ^= -1;
		for (var i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
		return crc ^ -1;
	}
	module.exports = crc32;
}));
// node_modules/pako/lib/zlib/messages.js
var require_messages = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		2: "need dictionary",
		1: "stream end",
		0: "",
		"-1": "file error",
		"-2": "stream error",
		"-3": "data error",
		"-4": "insufficient memory",
		"-5": "buffer error",
		"-6": "incompatible version"
	};
}));
// node_modules/pako/lib/zlib/deflate.js
var require_deflate$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_common();
	var trees = require_trees();
	var adler32 = require_adler32();
	var crc32 = require_crc32();
	var msg = require_messages();
	var Z_NO_FLUSH = 0;
	var Z_PARTIAL_FLUSH = 1;
	var Z_FULL_FLUSH = 3;
	var Z_FINISH = 4;
	var Z_BLOCK = 5;
	var Z_OK = 0;
	var Z_STREAM_END = 1;
	var Z_STREAM_ERROR = -2;
	var Z_DATA_ERROR = -3;
	var Z_BUF_ERROR = -5;
	var Z_DEFAULT_COMPRESSION = -1;
	var Z_FILTERED = 1;
	var Z_HUFFMAN_ONLY = 2;
	var Z_RLE = 3;
	var Z_FIXED = 4;
	var Z_DEFAULT_STRATEGY = 0;
	var Z_UNKNOWN = 2;
	var Z_DEFLATED = 8;
	var MAX_MEM_LEVEL = 9;
	var MAX_WBITS = 15;
	var DEF_MEM_LEVEL = 8;
	var L_CODES = 286;
	var D_CODES = 30;
	var BL_CODES = 19;
	var HEAP_SIZE = 2 * L_CODES + 1;
	var MAX_BITS = 15;
	var MIN_MATCH = 3;
	var MAX_MATCH = 258;
	var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
	var PRESET_DICT = 32;
	var INIT_STATE = 42;
	var EXTRA_STATE = 69;
	var NAME_STATE = 73;
	var COMMENT_STATE = 91;
	var HCRC_STATE = 103;
	var BUSY_STATE = 113;
	var FINISH_STATE = 666;
	var BS_NEED_MORE = 1;
	var BS_BLOCK_DONE = 2;
	var BS_FINISH_STARTED = 3;
	var BS_FINISH_DONE = 4;
	var OS_CODE = 3;
	function err(strm, errorCode) {
		strm.msg = msg[errorCode];
		return errorCode;
	}
	function rank(f) {
		return (f << 1) - (f > 4 ? 9 : 0);
	}
	function zero(buf) {
		var len = buf.length;
		while (--len >= 0) buf[len] = 0;
	}
	function flush_pending(strm) {
		var s = strm.state;
		var len = s.pending;
		if (len > strm.avail_out) len = strm.avail_out;
		if (len === 0) return;
		utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
		strm.next_out += len;
		s.pending_out += len;
		strm.total_out += len;
		strm.avail_out -= len;
		s.pending -= len;
		if (s.pending === 0) s.pending_out = 0;
	}
	function flush_block_only(s, last) {
		trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
		s.block_start = s.strstart;
		flush_pending(s.strm);
	}
	function put_byte(s, b) {
		s.pending_buf[s.pending++] = b;
	}
	function putShortMSB(s, b) {
		s.pending_buf[s.pending++] = b >>> 8 & 255;
		s.pending_buf[s.pending++] = b & 255;
	}
	function read_buf(strm, buf, start, size) {
		var len = strm.avail_in;
		if (len > size) len = size;
		if (len === 0) return 0;
		strm.avail_in -= len;
		utils.arraySet(buf, strm.input, strm.next_in, len, start);
		if (strm.state.wrap === 1) strm.adler = adler32(strm.adler, buf, len, start);
		else if (strm.state.wrap === 2) strm.adler = crc32(strm.adler, buf, len, start);
		strm.next_in += len;
		strm.total_in += len;
		return len;
	}
	function longest_match(s, cur_match) {
		var chain_length = s.max_chain_length;
		var scan = s.strstart;
		var match;
		var len;
		var best_len = s.prev_length;
		var nice_match = s.nice_match;
		var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
		var _win = s.window;
		var wmask = s.w_mask;
		var prev = s.prev;
		var strend = s.strstart + MAX_MATCH;
		var scan_end1 = _win[scan + best_len - 1];
		var scan_end = _win[scan + best_len];
		if (s.prev_length >= s.good_match) chain_length >>= 2;
		if (nice_match > s.lookahead) nice_match = s.lookahead;
		do {
			match = cur_match;
			if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) continue;
			scan += 2;
			match++;
			do;
			while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
			len = MAX_MATCH - (strend - scan);
			scan = strend - MAX_MATCH;
			if (len > best_len) {
				s.match_start = cur_match;
				best_len = len;
				if (len >= nice_match) break;
				scan_end1 = _win[scan + best_len - 1];
				scan_end = _win[scan + best_len];
			}
		} while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
		if (best_len <= s.lookahead) return best_len;
		return s.lookahead;
	}
	function fill_window(s) {
		var _w_size = s.w_size;
		var p, n, m, more, str;
		do {
			more = s.window_size - s.lookahead - s.strstart;
			if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
				utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
				s.match_start -= _w_size;
				s.strstart -= _w_size;
				s.block_start -= _w_size;
				n = s.hash_size;
				p = n;
				do {
					m = s.head[--p];
					s.head[p] = m >= _w_size ? m - _w_size : 0;
				} while (--n);
				n = _w_size;
				p = n;
				do {
					m = s.prev[--p];
					s.prev[p] = m >= _w_size ? m - _w_size : 0;
				} while (--n);
				more += _w_size;
			}
			if (s.strm.avail_in === 0) break;
			n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
			s.lookahead += n;
			if (s.lookahead + s.insert >= MIN_MATCH) {
				str = s.strstart - s.insert;
				s.ins_h = s.window[str];
				s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
				while (s.insert) {
					s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
					s.prev[str & s.w_mask] = s.head[s.ins_h];
					s.head[s.ins_h] = str;
					str++;
					s.insert--;
					if (s.lookahead + s.insert < MIN_MATCH) break;
				}
			}
		} while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
	}
	function deflate_stored(s, flush) {
		var max_block_size = 65535;
		if (max_block_size > s.pending_buf_size - 5) max_block_size = s.pending_buf_size - 5;
		for (;;) {
			if (s.lookahead <= 1) {
				fill_window(s);
				if (s.lookahead === 0 && flush === Z_NO_FLUSH) return BS_NEED_MORE;
				if (s.lookahead === 0) break;
			}
			s.strstart += s.lookahead;
			s.lookahead = 0;
			var max_start = s.block_start + max_block_size;
			if (s.strstart === 0 || s.strstart >= max_start) {
				s.lookahead = s.strstart - max_start;
				s.strstart = max_start;
				/*** FLUSH_BLOCK(s, 0); ***/
				flush_block_only(s, false);
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			}
			if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
				/*** FLUSH_BLOCK(s, 0); ***/
				flush_block_only(s, false);
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			}
		}
		s.insert = 0;
		if (flush === Z_FINISH) {
			/*** FLUSH_BLOCK(s, 1); ***/
			flush_block_only(s, true);
			if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
			return BS_FINISH_DONE;
		}
		if (s.strstart > s.block_start) {
			/*** FLUSH_BLOCK(s, 0); ***/
			flush_block_only(s, false);
			if (s.strm.avail_out === 0) return BS_NEED_MORE;
		}
		return BS_NEED_MORE;
	}
	function deflate_fast(s, flush) {
		var hash_head;
		var bflush;
		for (;;) {
			if (s.lookahead < MIN_LOOKAHEAD) {
				fill_window(s);
				if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) return BS_NEED_MORE;
				if (s.lookahead === 0) break;
			}
			hash_head = 0;
			if (s.lookahead >= MIN_MATCH) {
				/*** INSERT_STRING(s, s.strstart, hash_head); ***/
				s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
				hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
				s.head[s.ins_h] = s.strstart;
			}
			if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) s.match_length = longest_match(s, hash_head);
			if (s.match_length >= MIN_MATCH) {
				/*** _tr_tally_dist(s, s.strstart - s.match_start,
				s.match_length - MIN_MATCH, bflush); ***/
				bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
				s.lookahead -= s.match_length;
				if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
					s.match_length--;
					do {
						s.strstart++;
						/*** INSERT_STRING(s, s.strstart, hash_head); ***/
						s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
						hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
						s.head[s.ins_h] = s.strstart;
					} while (--s.match_length !== 0);
					s.strstart++;
				} else {
					s.strstart += s.match_length;
					s.match_length = 0;
					s.ins_h = s.window[s.strstart];
					s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
				}
			} else {
				/*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
				bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
				s.lookahead--;
				s.strstart++;
			}
			if (bflush) {
				/*** FLUSH_BLOCK(s, 0); ***/
				flush_block_only(s, false);
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			}
		}
		s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
		if (flush === Z_FINISH) {
			/*** FLUSH_BLOCK(s, 1); ***/
			flush_block_only(s, true);
			if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
			return BS_FINISH_DONE;
		}
		if (s.last_lit) {
			/*** FLUSH_BLOCK(s, 0); ***/
			flush_block_only(s, false);
			if (s.strm.avail_out === 0) return BS_NEED_MORE;
		}
		return BS_BLOCK_DONE;
	}
	function deflate_slow(s, flush) {
		var hash_head;
		var bflush;
		var max_insert;
		for (;;) {
			if (s.lookahead < MIN_LOOKAHEAD) {
				fill_window(s);
				if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) return BS_NEED_MORE;
				if (s.lookahead === 0) break;
			}
			hash_head = 0;
			if (s.lookahead >= MIN_MATCH) {
				/*** INSERT_STRING(s, s.strstart, hash_head); ***/
				s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
				hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
				s.head[s.ins_h] = s.strstart;
			}
			s.prev_length = s.match_length;
			s.prev_match = s.match_start;
			s.match_length = MIN_MATCH - 1;
			if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
				s.match_length = longest_match(s, hash_head);
				if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) s.match_length = MIN_MATCH - 1;
			}
			if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
				max_insert = s.strstart + s.lookahead - MIN_MATCH;
				/***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
				s.prev_length - MIN_MATCH, bflush);***/
				bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
				s.lookahead -= s.prev_length - 1;
				s.prev_length -= 2;
				do
					if (++s.strstart <= max_insert) {
						/*** INSERT_STRING(s, s.strstart, hash_head); ***/
						s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
						hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
						s.head[s.ins_h] = s.strstart;
					}
				while (--s.prev_length !== 0);
				s.match_available = 0;
				s.match_length = MIN_MATCH - 1;
				s.strstart++;
				if (bflush) {
					/*** FLUSH_BLOCK(s, 0); ***/
					flush_block_only(s, false);
					if (s.strm.avail_out === 0) return BS_NEED_MORE;
				}
			} else if (s.match_available) {
				/*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
				bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
				if (bflush)
 /*** FLUSH_BLOCK_ONLY(s, 0) ***/
				flush_block_only(s, false);
				s.strstart++;
				s.lookahead--;
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			} else {
				s.match_available = 1;
				s.strstart++;
				s.lookahead--;
			}
		}
		if (s.match_available) {
			/*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
			bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
			s.match_available = 0;
		}
		s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
		if (flush === Z_FINISH) {
			/*** FLUSH_BLOCK(s, 1); ***/
			flush_block_only(s, true);
			if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
			return BS_FINISH_DONE;
		}
		if (s.last_lit) {
			/*** FLUSH_BLOCK(s, 0); ***/
			flush_block_only(s, false);
			if (s.strm.avail_out === 0) return BS_NEED_MORE;
		}
		return BS_BLOCK_DONE;
	}
	function deflate_rle(s, flush) {
		var bflush;
		var prev;
		var scan, strend;
		var _win = s.window;
		for (;;) {
			if (s.lookahead <= MAX_MATCH) {
				fill_window(s);
				if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) return BS_NEED_MORE;
				if (s.lookahead === 0) break;
			}
			s.match_length = 0;
			if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
				scan = s.strstart - 1;
				prev = _win[scan];
				if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
					strend = s.strstart + MAX_MATCH;
					do;
					while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
					s.match_length = MAX_MATCH - (strend - scan);
					if (s.match_length > s.lookahead) s.match_length = s.lookahead;
				}
			}
			if (s.match_length >= MIN_MATCH) {
				/*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
				bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
				s.lookahead -= s.match_length;
				s.strstart += s.match_length;
				s.match_length = 0;
			} else {
				/*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
				bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
				s.lookahead--;
				s.strstart++;
			}
			if (bflush) {
				/*** FLUSH_BLOCK(s, 0); ***/
				flush_block_only(s, false);
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			}
		}
		s.insert = 0;
		if (flush === Z_FINISH) {
			/*** FLUSH_BLOCK(s, 1); ***/
			flush_block_only(s, true);
			if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
			return BS_FINISH_DONE;
		}
		if (s.last_lit) {
			/*** FLUSH_BLOCK(s, 0); ***/
			flush_block_only(s, false);
			if (s.strm.avail_out === 0) return BS_NEED_MORE;
		}
		return BS_BLOCK_DONE;
	}
	function deflate_huff(s, flush) {
		var bflush;
		for (;;) {
			if (s.lookahead === 0) {
				fill_window(s);
				if (s.lookahead === 0) {
					if (flush === Z_NO_FLUSH) return BS_NEED_MORE;
					break;
				}
			}
			s.match_length = 0;
			/*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
			bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
			s.lookahead--;
			s.strstart++;
			if (bflush) {
				/*** FLUSH_BLOCK(s, 0); ***/
				flush_block_only(s, false);
				if (s.strm.avail_out === 0) return BS_NEED_MORE;
			}
		}
		s.insert = 0;
		if (flush === Z_FINISH) {
			/*** FLUSH_BLOCK(s, 1); ***/
			flush_block_only(s, true);
			if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
			return BS_FINISH_DONE;
		}
		if (s.last_lit) {
			/*** FLUSH_BLOCK(s, 0); ***/
			flush_block_only(s, false);
			if (s.strm.avail_out === 0) return BS_NEED_MORE;
		}
		return BS_BLOCK_DONE;
	}
	function Config(good_length, max_lazy, nice_length, max_chain, func) {
		this.good_length = good_length;
		this.max_lazy = max_lazy;
		this.nice_length = nice_length;
		this.max_chain = max_chain;
		this.func = func;
	}
	var configuration_table = [
		new Config(0, 0, 0, 0, deflate_stored),
		new Config(4, 4, 8, 4, deflate_fast),
		new Config(4, 5, 16, 8, deflate_fast),
		new Config(4, 6, 32, 32, deflate_fast),
		new Config(4, 4, 16, 16, deflate_slow),
		new Config(8, 16, 32, 32, deflate_slow),
		new Config(8, 16, 128, 128, deflate_slow),
		new Config(8, 32, 128, 256, deflate_slow),
		new Config(32, 128, 258, 1024, deflate_slow),
		new Config(32, 258, 258, 4096, deflate_slow)
	];
	function lm_init(s) {
		s.window_size = 2 * s.w_size;
		/*** CLEAR_HASH(s); ***/
		zero(s.head);
		s.max_lazy_match = configuration_table[s.level].max_lazy;
		s.good_match = configuration_table[s.level].good_length;
		s.nice_match = configuration_table[s.level].nice_length;
		s.max_chain_length = configuration_table[s.level].max_chain;
		s.strstart = 0;
		s.block_start = 0;
		s.lookahead = 0;
		s.insert = 0;
		s.match_length = s.prev_length = MIN_MATCH - 1;
		s.match_available = 0;
		s.ins_h = 0;
	}
	function DeflateState() {
		this.strm = null;
		this.status = 0;
		this.pending_buf = null;
		this.pending_buf_size = 0;
		this.pending_out = 0;
		this.pending = 0;
		this.wrap = 0;
		this.gzhead = null;
		this.gzindex = 0;
		this.method = Z_DEFLATED;
		this.last_flush = -1;
		this.w_size = 0;
		this.w_bits = 0;
		this.w_mask = 0;
		this.window = null;
		this.window_size = 0;
		this.prev = null;
		this.head = null;
		this.ins_h = 0;
		this.hash_size = 0;
		this.hash_bits = 0;
		this.hash_mask = 0;
		this.hash_shift = 0;
		this.block_start = 0;
		this.match_length = 0;
		this.prev_match = 0;
		this.match_available = 0;
		this.strstart = 0;
		this.match_start = 0;
		this.lookahead = 0;
		this.prev_length = 0;
		this.max_chain_length = 0;
		this.max_lazy_match = 0;
		this.level = 0;
		this.strategy = 0;
		this.good_match = 0;
		this.nice_match = 0;
		this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
		this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
		this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
		zero(this.dyn_ltree);
		zero(this.dyn_dtree);
		zero(this.bl_tree);
		this.l_desc = null;
		this.d_desc = null;
		this.bl_desc = null;
		this.bl_count = new utils.Buf16(MAX_BITS + 1);
		this.heap = new utils.Buf16(2 * L_CODES + 1);
		zero(this.heap);
		this.heap_len = 0;
		this.heap_max = 0;
		this.depth = new utils.Buf16(2 * L_CODES + 1);
		zero(this.depth);
		this.l_buf = 0;
		this.lit_bufsize = 0;
		this.last_lit = 0;
		this.d_buf = 0;
		this.opt_len = 0;
		this.static_len = 0;
		this.matches = 0;
		this.insert = 0;
		this.bi_buf = 0;
		this.bi_valid = 0;
	}
	function deflateResetKeep(strm) {
		var s;
		if (!strm || !strm.state) return err(strm, Z_STREAM_ERROR);
		strm.total_in = strm.total_out = 0;
		strm.data_type = Z_UNKNOWN;
		s = strm.state;
		s.pending = 0;
		s.pending_out = 0;
		if (s.wrap < 0) s.wrap = -s.wrap;
		s.status = s.wrap ? INIT_STATE : BUSY_STATE;
		strm.adler = s.wrap === 2 ? 0 : 1;
		s.last_flush = Z_NO_FLUSH;
		trees._tr_init(s);
		return Z_OK;
	}
	function deflateReset(strm) {
		var ret = deflateResetKeep(strm);
		if (ret === Z_OK) lm_init(strm.state);
		return ret;
	}
	function deflateSetHeader(strm, head) {
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		if (strm.state.wrap !== 2) return Z_STREAM_ERROR;
		strm.state.gzhead = head;
		return Z_OK;
	}
	function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
		if (!strm) return Z_STREAM_ERROR;
		var wrap = 1;
		if (level === Z_DEFAULT_COMPRESSION) level = 6;
		if (windowBits < 0) {
			wrap = 0;
			windowBits = -windowBits;
		} else if (windowBits > 15) {
			wrap = 2;
			windowBits -= 16;
		}
		if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) return err(strm, Z_STREAM_ERROR);
		if (windowBits === 8) windowBits = 9;
		var s = new DeflateState();
		strm.state = s;
		s.strm = strm;
		s.wrap = wrap;
		s.gzhead = null;
		s.w_bits = windowBits;
		s.w_size = 1 << s.w_bits;
		s.w_mask = s.w_size - 1;
		s.hash_bits = memLevel + 7;
		s.hash_size = 1 << s.hash_bits;
		s.hash_mask = s.hash_size - 1;
		s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
		s.window = new utils.Buf8(s.w_size * 2);
		s.head = new utils.Buf16(s.hash_size);
		s.prev = new utils.Buf16(s.w_size);
		s.lit_bufsize = 1 << memLevel + 6;
		s.pending_buf_size = s.lit_bufsize * 4;
		s.pending_buf = new utils.Buf8(s.pending_buf_size);
		s.d_buf = 1 * s.lit_bufsize;
		s.l_buf = 3 * s.lit_bufsize;
		s.level = level;
		s.strategy = strategy;
		s.method = method;
		return deflateReset(strm);
	}
	function deflateInit(strm, level) {
		return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
	}
	function deflate(strm, flush) {
		var old_flush, s;
		var beg, val;
		if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
		s = strm.state;
		if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
		s.strm = strm;
		old_flush = s.last_flush;
		s.last_flush = flush;
		if (s.status === INIT_STATE) {
			if (s.wrap === 2) {
				strm.adler = 0;
				put_byte(s, 31);
				put_byte(s, 139);
				put_byte(s, 8);
				if (!s.gzhead) {
					put_byte(s, 0);
					put_byte(s, 0);
					put_byte(s, 0);
					put_byte(s, 0);
					put_byte(s, 0);
					put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
					put_byte(s, OS_CODE);
					s.status = BUSY_STATE;
				} else {
					put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
					put_byte(s, s.gzhead.time & 255);
					put_byte(s, s.gzhead.time >> 8 & 255);
					put_byte(s, s.gzhead.time >> 16 & 255);
					put_byte(s, s.gzhead.time >> 24 & 255);
					put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
					put_byte(s, s.gzhead.os & 255);
					if (s.gzhead.extra && s.gzhead.extra.length) {
						put_byte(s, s.gzhead.extra.length & 255);
						put_byte(s, s.gzhead.extra.length >> 8 & 255);
					}
					if (s.gzhead.hcrc) strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
					s.gzindex = 0;
					s.status = EXTRA_STATE;
				}
			} else {
				var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
				var level_flags = -1;
				if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) level_flags = 0;
				else if (s.level < 6) level_flags = 1;
				else if (s.level === 6) level_flags = 2;
				else level_flags = 3;
				header |= level_flags << 6;
				if (s.strstart !== 0) header |= PRESET_DICT;
				header += 31 - header % 31;
				s.status = BUSY_STATE;
				putShortMSB(s, header);
				if (s.strstart !== 0) {
					putShortMSB(s, strm.adler >>> 16);
					putShortMSB(s, strm.adler & 65535);
				}
				strm.adler = 1;
			}
		}
		if (s.status === EXTRA_STATE) {
			if (s.gzhead.extra) {
				beg = s.pending;
				while (s.gzindex < (s.gzhead.extra.length & 65535)) {
					if (s.pending === s.pending_buf_size) {
						if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
						flush_pending(strm);
						beg = s.pending;
						if (s.pending === s.pending_buf_size) break;
					}
					put_byte(s, s.gzhead.extra[s.gzindex] & 255);
					s.gzindex++;
				}
				if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
				if (s.gzindex === s.gzhead.extra.length) {
					s.gzindex = 0;
					s.status = NAME_STATE;
				}
			} else s.status = NAME_STATE;
		}
		if (s.status === NAME_STATE) {
			if (s.gzhead.name) {
				beg = s.pending;
				do {
					if (s.pending === s.pending_buf_size) {
						if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
						flush_pending(strm);
						beg = s.pending;
						if (s.pending === s.pending_buf_size) {
							val = 1;
							break;
						}
					}
					if (s.gzindex < s.gzhead.name.length) val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
					else val = 0;
					put_byte(s, val);
				} while (val !== 0);
				if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
				if (val === 0) {
					s.gzindex = 0;
					s.status = COMMENT_STATE;
				}
			} else s.status = COMMENT_STATE;
		}
		if (s.status === COMMENT_STATE) {
			if (s.gzhead.comment) {
				beg = s.pending;
				do {
					if (s.pending === s.pending_buf_size) {
						if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
						flush_pending(strm);
						beg = s.pending;
						if (s.pending === s.pending_buf_size) {
							val = 1;
							break;
						}
					}
					if (s.gzindex < s.gzhead.comment.length) val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
					else val = 0;
					put_byte(s, val);
				} while (val !== 0);
				if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
				if (val === 0) s.status = HCRC_STATE;
			} else s.status = HCRC_STATE;
		}
		if (s.status === HCRC_STATE) {
			if (s.gzhead.hcrc) {
				if (s.pending + 2 > s.pending_buf_size) flush_pending(strm);
				if (s.pending + 2 <= s.pending_buf_size) {
					put_byte(s, strm.adler & 255);
					put_byte(s, strm.adler >> 8 & 255);
					strm.adler = 0;
					s.status = BUSY_STATE;
				}
			} else s.status = BUSY_STATE;
		}
		if (s.pending !== 0) {
			flush_pending(strm);
			if (strm.avail_out === 0) {
				s.last_flush = -1;
				return Z_OK;
			}
		} else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) return err(strm, Z_BUF_ERROR);
		if (s.status === FINISH_STATE && strm.avail_in !== 0) return err(strm, Z_BUF_ERROR);
		if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
			var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
			if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) s.status = FINISH_STATE;
			if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
				if (strm.avail_out === 0) s.last_flush = -1;
				return Z_OK;
			}
			if (bstate === BS_BLOCK_DONE) {
				if (flush === Z_PARTIAL_FLUSH) trees._tr_align(s);
				else if (flush !== Z_BLOCK) {
					trees._tr_stored_block(s, 0, 0, false);
					if (flush === Z_FULL_FLUSH) {
						/*** CLEAR_HASH(s); ***/ zero(s.head);
						if (s.lookahead === 0) {
							s.strstart = 0;
							s.block_start = 0;
							s.insert = 0;
						}
					}
				}
				flush_pending(strm);
				if (strm.avail_out === 0) {
					s.last_flush = -1;
					return Z_OK;
				}
			}
		}
		if (flush !== Z_FINISH) return Z_OK;
		if (s.wrap <= 0) return Z_STREAM_END;
		if (s.wrap === 2) {
			put_byte(s, strm.adler & 255);
			put_byte(s, strm.adler >> 8 & 255);
			put_byte(s, strm.adler >> 16 & 255);
			put_byte(s, strm.adler >> 24 & 255);
			put_byte(s, strm.total_in & 255);
			put_byte(s, strm.total_in >> 8 & 255);
			put_byte(s, strm.total_in >> 16 & 255);
			put_byte(s, strm.total_in >> 24 & 255);
		} else {
			putShortMSB(s, strm.adler >>> 16);
			putShortMSB(s, strm.adler & 65535);
		}
		flush_pending(strm);
		if (s.wrap > 0) s.wrap = -s.wrap;
		return s.pending !== 0 ? Z_OK : Z_STREAM_END;
	}
	function deflateEnd(strm) {
		var status;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		status = strm.state.status;
		if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) return err(strm, Z_STREAM_ERROR);
		strm.state = null;
		return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
	}
	function deflateSetDictionary(strm, dictionary) {
		var dictLength = dictionary.length;
		var s;
		var str, n;
		var wrap;
		var avail;
		var next;
		var input;
		var tmpDict;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		s = strm.state;
		wrap = s.wrap;
		if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) return Z_STREAM_ERROR;
		if (wrap === 1) strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
		s.wrap = 0;
		if (dictLength >= s.w_size) {
			if (wrap === 0) {
				/*** CLEAR_HASH(s); ***/
				zero(s.head);
				s.strstart = 0;
				s.block_start = 0;
				s.insert = 0;
			}
			tmpDict = new utils.Buf8(s.w_size);
			utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
			dictionary = tmpDict;
			dictLength = s.w_size;
		}
		avail = strm.avail_in;
		next = strm.next_in;
		input = strm.input;
		strm.avail_in = dictLength;
		strm.next_in = 0;
		strm.input = dictionary;
		fill_window(s);
		while (s.lookahead >= MIN_MATCH) {
			str = s.strstart;
			n = s.lookahead - (MIN_MATCH - 1);
			do {
				s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
				s.prev[str & s.w_mask] = s.head[s.ins_h];
				s.head[s.ins_h] = str;
				str++;
			} while (--n);
			s.strstart = str;
			s.lookahead = MIN_MATCH - 1;
			fill_window(s);
		}
		s.strstart += s.lookahead;
		s.block_start = s.strstart;
		s.insert = s.lookahead;
		s.lookahead = 0;
		s.match_length = s.prev_length = MIN_MATCH - 1;
		s.match_available = 0;
		strm.next_in = next;
		strm.input = input;
		strm.avail_in = avail;
		s.wrap = wrap;
		return Z_OK;
	}
	exports.deflateInit = deflateInit;
	exports.deflateInit2 = deflateInit2;
	exports.deflateReset = deflateReset;
	exports.deflateResetKeep = deflateResetKeep;
	exports.deflateSetHeader = deflateSetHeader;
	exports.deflate = deflate;
	exports.deflateEnd = deflateEnd;
	exports.deflateSetDictionary = deflateSetDictionary;
	exports.deflateInfo = "pako deflate (from Nodeca project)";
}));
// node_modules/pako/lib/utils/strings.js
var require_strings = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_common();
	var STR_APPLY_OK = true;
	var STR_APPLY_UIA_OK = true;
	try {
		String.fromCharCode.apply(null, [0]);
	} catch (__) {
		STR_APPLY_OK = false;
	}
	try {
		String.fromCharCode.apply(null, /* @__PURE__ */ new Uint8Array(1));
	} catch (__) {
		STR_APPLY_UIA_OK = false;
	}
	var _utf8len = new utils.Buf8(256);
	for (var q = 0; q < 256; q++) _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
	_utf8len[254] = _utf8len[254] = 1;
	exports.string2buf = function(str) {
		var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
		for (m_pos = 0; m_pos < str_len; m_pos++) {
			c = str.charCodeAt(m_pos);
			if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
				c2 = str.charCodeAt(m_pos + 1);
				if ((c2 & 64512) === 56320) {
					c = 65536 + (c - 55296 << 10) + (c2 - 56320);
					m_pos++;
				}
			}
			buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
		}
		buf = new utils.Buf8(buf_len);
		for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
			c = str.charCodeAt(m_pos);
			if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
				c2 = str.charCodeAt(m_pos + 1);
				if ((c2 & 64512) === 56320) {
					c = 65536 + (c - 55296 << 10) + (c2 - 56320);
					m_pos++;
				}
			}
			if (c < 128) buf[i++] = c;
			else if (c < 2048) {
				buf[i++] = 192 | c >>> 6;
				buf[i++] = 128 | c & 63;
			} else if (c < 65536) {
				buf[i++] = 224 | c >>> 12;
				buf[i++] = 128 | c >>> 6 & 63;
				buf[i++] = 128 | c & 63;
			} else {
				buf[i++] = 240 | c >>> 18;
				buf[i++] = 128 | c >>> 12 & 63;
				buf[i++] = 128 | c >>> 6 & 63;
				buf[i++] = 128 | c & 63;
			}
		}
		return buf;
	};
	function buf2binstring(buf, len) {
		if (len < 65534) {
			if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
		}
		var result = "";
		for (var i = 0; i < len; i++) result += String.fromCharCode(buf[i]);
		return result;
	}
	exports.buf2binstring = function(buf) {
		return buf2binstring(buf, buf.length);
	};
	exports.binstring2buf = function(str) {
		var buf = new utils.Buf8(str.length);
		for (var i = 0, len = buf.length; i < len; i++) buf[i] = str.charCodeAt(i);
		return buf;
	};
	exports.buf2string = function(buf, max) {
		var i, out, c, c_len;
		var len = max || buf.length;
		var utf16buf = new Array(len * 2);
		for (out = 0, i = 0; i < len;) {
			c = buf[i++];
			if (c < 128) {
				utf16buf[out++] = c;
				continue;
			}
			c_len = _utf8len[c];
			if (c_len > 4) {
				utf16buf[out++] = 65533;
				i += c_len - 1;
				continue;
			}
			c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
			while (c_len > 1 && i < len) {
				c = c << 6 | buf[i++] & 63;
				c_len--;
			}
			if (c_len > 1) {
				utf16buf[out++] = 65533;
				continue;
			}
			if (c < 65536) utf16buf[out++] = c;
			else {
				c -= 65536;
				utf16buf[out++] = 55296 | c >> 10 & 1023;
				utf16buf[out++] = 56320 | c & 1023;
			}
		}
		return buf2binstring(utf16buf, out);
	};
	exports.utf8border = function(buf, max) {
		var pos;
		max = max || buf.length;
		if (max > buf.length) max = buf.length;
		pos = max - 1;
		while (pos >= 0 && (buf[pos] & 192) === 128) pos--;
		if (pos < 0) return max;
		if (pos === 0) return max;
		return pos + _utf8len[buf[pos]] > max ? pos : max;
	};
}));
// node_modules/pako/lib/zlib/zstream.js
var require_zstream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function ZStream() {
		this.input = null;
		this.next_in = 0;
		this.avail_in = 0;
		this.total_in = 0;
		this.output = null;
		this.next_out = 0;
		this.avail_out = 0;
		this.total_out = 0;
		this.msg = "";
		this.state = null;
		this.data_type = 2;
		this.adler = 0;
	}
	module.exports = ZStream;
}));
// node_modules/pako/lib/deflate.js
var require_deflate = /* @__PURE__ */ __commonJSMin(((exports) => {
	var zlib_deflate = require_deflate$1();
	var utils = require_common();
	var strings = require_strings();
	var msg = require_messages();
	var ZStream = require_zstream();
	var toString = Object.prototype.toString;
	var Z_NO_FLUSH = 0;
	var Z_FINISH = 4;
	var Z_OK = 0;
	var Z_STREAM_END = 1;
	var Z_SYNC_FLUSH = 2;
	var Z_DEFAULT_COMPRESSION = -1;
	var Z_DEFAULT_STRATEGY = 0;
	var Z_DEFLATED = 8;
	/**
	* class Deflate
	*
	* Generic JS-style wrapper for zlib calls. If you don't need
	* streaming behaviour - use more simple functions: [[deflate]],
	* [[deflateRaw]] and [[gzip]].
	**/
	/**
	* Deflate.result -> Uint8Array|Array
	*
	* Compressed result, generated by default [[Deflate#onData]]
	* and [[Deflate#onEnd]] handlers. Filled after you push last chunk
	* (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
	* push a chunk with explicit flush (call [[Deflate#push]] with
	* `Z_SYNC_FLUSH` param).
	**/
	/**
	* Deflate.err -> Number
	*
	* Error code after deflate finished. 0 (Z_OK) on success.
	* You will not need it in real life, because deflate errors
	* are possible only on wrong options or bad `onData` / `onEnd`
	* custom handlers.
	**/
	/**
	* Deflate.msg -> String
	*
	* Error message, if [[Deflate.err]] != 0
	**/
	/**
	* new Deflate(options)
	* - options (Object): zlib deflate options.
	*
	* Creates new deflator instance with specified params. Throws exception
	* on bad params. Supported options:
	*
	* - `level`
	* - `windowBits`
	* - `memLevel`
	* - `strategy`
	* - `dictionary`
	*
	* [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
	* for more information on these.
	*
	* Additional options, for internal needs:
	*
	* - `chunkSize` - size of generated data chunks (16K by default)
	* - `raw` (Boolean) - do raw deflate
	* - `gzip` (Boolean) - create gzip wrapper
	* - `to` (String) - if equal to 'string', then result will be "binary string"
	*    (each char code [0..255])
	* - `header` (Object) - custom header for gzip
	*   - `text` (Boolean) - true if compressed data believed to be text
	*   - `time` (Number) - modification time, unix timestamp
	*   - `os` (Number) - operation system code
	*   - `extra` (Array) - array of bytes with extra data (max 65536)
	*   - `name` (String) - file name (binary string)
	*   - `comment` (String) - comment (binary string)
	*   - `hcrc` (Boolean) - true if header crc should be added
	*
	* ##### Example:
	*
	* ```javascript
	* var pako = require('pako')
	*   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
	*   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
	*
	* var deflate = new pako.Deflate({ level: 3});
	*
	* deflate.push(chunk1, false);
	* deflate.push(chunk2, true);  // true -> last chunk
	*
	* if (deflate.err) { throw new Error(deflate.err); }
	*
	* console.log(deflate.result);
	* ```
	**/
	function Deflate(options) {
		if (!(this instanceof Deflate)) return new Deflate(options);
		this.options = utils.assign({
			level: Z_DEFAULT_COMPRESSION,
			method: Z_DEFLATED,
			chunkSize: 16384,
			windowBits: 15,
			memLevel: 8,
			strategy: Z_DEFAULT_STRATEGY,
			to: ""
		}, options || {});
		var opt = this.options;
		if (opt.raw && opt.windowBits > 0) opt.windowBits = -opt.windowBits;
		else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) opt.windowBits += 16;
		this.err = 0;
		this.msg = "";
		this.ended = false;
		this.chunks = [];
		this.strm = new ZStream();
		this.strm.avail_out = 0;
		var status = zlib_deflate.deflateInit2(this.strm, opt.level, opt.method, opt.windowBits, opt.memLevel, opt.strategy);
		if (status !== Z_OK) throw new Error(msg[status]);
		if (opt.header) zlib_deflate.deflateSetHeader(this.strm, opt.header);
		if (opt.dictionary) {
			var dict;
			if (typeof opt.dictionary === "string") dict = strings.string2buf(opt.dictionary);
			else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") dict = new Uint8Array(opt.dictionary);
			else dict = opt.dictionary;
			status = zlib_deflate.deflateSetDictionary(this.strm, dict);
			if (status !== Z_OK) throw new Error(msg[status]);
			this._dict_set = true;
		}
	}
	/**
	* Deflate#push(data[, mode]) -> Boolean
	* - data (Uint8Array|Array|ArrayBuffer|String): input data. Strings will be
	*   converted to utf8 byte sequence.
	* - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
	*   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
	*
	* Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
	* new compressed chunks. Returns `true` on success. The last data block must have
	* mode Z_FINISH (or `true`). That will flush internal pending buffers and call
	* [[Deflate#onEnd]]. For interim explicit flushes (without ending the stream) you
	* can use mode Z_SYNC_FLUSH, keeping the compression context.
	*
	* On fail call [[Deflate#onEnd]] with error code and return false.
	*
	* We strongly recommend to use `Uint8Array` on input for best speed (output
	* array format is detected automatically). Also, don't skip last param and always
	* use the same type in your code (boolean or number). That will improve JS speed.
	*
	* For regular `Array`-s make sure all elements are [0..255].
	*
	* ##### Example
	*
	* ```javascript
	* push(chunk, false); // push one of data chunks
	* ...
	* push(chunk, true);  // push last chunk
	* ```
	**/
	Deflate.prototype.push = function(data, mode) {
		var strm = this.strm;
		var chunkSize = this.options.chunkSize;
		var status, _mode;
		if (this.ended) return false;
		_mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;
		if (typeof data === "string") strm.input = strings.string2buf(data);
		else if (toString.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
		else strm.input = data;
		strm.next_in = 0;
		strm.avail_in = strm.input.length;
		do {
			if (strm.avail_out === 0) {
				strm.output = new utils.Buf8(chunkSize);
				strm.next_out = 0;
				strm.avail_out = chunkSize;
			}
			status = zlib_deflate.deflate(strm, _mode);
			if (status !== Z_STREAM_END && status !== Z_OK) {
				this.onEnd(status);
				this.ended = true;
				return false;
			}
			if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
				if (this.options.to === "string") this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
				else this.onData(utils.shrinkBuf(strm.output, strm.next_out));
			}
		} while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);
		if (_mode === Z_FINISH) {
			status = zlib_deflate.deflateEnd(this.strm);
			this.onEnd(status);
			this.ended = true;
			return status === Z_OK;
		}
		if (_mode === Z_SYNC_FLUSH) {
			this.onEnd(Z_OK);
			strm.avail_out = 0;
			return true;
		}
		return true;
	};
	/**
	* Deflate#onData(chunk) -> Void
	* - chunk (Uint8Array|Array|String): output data. Type of array depends
	*   on js engine support. When string output requested, each chunk
	*   will be string.
	*
	* By default, stores data blocks in `chunks[]` property and glue
	* those in `onEnd`. Override this handler, if you need another behaviour.
	**/
	Deflate.prototype.onData = function(chunk) {
		this.chunks.push(chunk);
	};
	/**
	* Deflate#onEnd(status) -> Void
	* - status (Number): deflate status. 0 (Z_OK) on success,
	*   other if not.
	*
	* Called once after you tell deflate that the input stream is
	* complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
	* or if an error happened. By default - join collected chunks,
	* free memory and fill `results` / `err` properties.
	**/
	Deflate.prototype.onEnd = function(status) {
		if (status === Z_OK) {
			if (this.options.to === "string") this.result = this.chunks.join("");
			else this.result = utils.flattenChunks(this.chunks);
		}
		this.chunks = [];
		this.err = status;
		this.msg = this.strm.msg;
	};
	/**
	* deflate(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to compress.
	* - options (Object): zlib deflate options.
	*
	* Compress `data` with deflate algorithm and `options`.
	*
	* Supported options are:
	*
	* - level
	* - windowBits
	* - memLevel
	* - strategy
	* - dictionary
	*
	* [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
	* for more information on these.
	*
	* Sugar (options):
	*
	* - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
	*   negative windowBits implicitly.
	* - `to` (String) - if equal to 'string', then result will be "binary string"
	*    (each char code [0..255])
	*
	* ##### Example:
	*
	* ```javascript
	* var pako = require('pako')
	*   , data = Uint8Array([1,2,3,4,5,6,7,8,9]);
	*
	* console.log(pako.deflate(data));
	* ```
	**/
	function deflate(input, options) {
		var deflator = new Deflate(options);
		deflator.push(input, true);
		if (deflator.err) throw deflator.msg || msg[deflator.err];
		return deflator.result;
	}
	/**
	* deflateRaw(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to compress.
	* - options (Object): zlib deflate options.
	*
	* The same as [[deflate]], but creates raw data, without wrapper
	* (header and adler32 crc).
	**/
	function deflateRaw(input, options) {
		options = options || {};
		options.raw = true;
		return deflate(input, options);
	}
	/**
	* gzip(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to compress.
	* - options (Object): zlib deflate options.
	*
	* The same as [[deflate]], but create gzip wrapper instead of
	* deflate one.
	**/
	function gzip(input, options) {
		options = options || {};
		options.gzip = true;
		return deflate(input, options);
	}
	exports.Deflate = Deflate;
	exports.deflate = deflate;
	exports.deflateRaw = deflateRaw;
	exports.gzip = gzip;
}));
// node_modules/pako/lib/zlib/inffast.js
var require_inffast = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var BAD = 30;
	var TYPE = 12;
	module.exports = function inflate_fast(strm, start) {
		var state;
		var _in;
		var last;
		var _out;
		var beg;
		var end;
		var dmax;
		var wsize;
		var whave;
		var wnext;
		var s_window;
		var hold;
		var bits;
		var lcode;
		var dcode;
		var lmask;
		var dmask;
		var here;
		var op;
		var len;
		var dist;
		var from;
		var from_source;
		var input, output;
		state = strm.state;
		_in = strm.next_in;
		input = strm.input;
		last = _in + (strm.avail_in - 5);
		_out = strm.next_out;
		output = strm.output;
		beg = _out - (start - strm.avail_out);
		end = _out + (strm.avail_out - 257);
		dmax = state.dmax;
		wsize = state.wsize;
		whave = state.whave;
		wnext = state.wnext;
		s_window = state.window;
		hold = state.hold;
		bits = state.bits;
		lcode = state.lencode;
		dcode = state.distcode;
		lmask = (1 << state.lenbits) - 1;
		dmask = (1 << state.distbits) - 1;
		top: do {
			if (bits < 15) {
				hold += input[_in++] << bits;
				bits += 8;
				hold += input[_in++] << bits;
				bits += 8;
			}
			here = lcode[hold & lmask];
			dolen: for (;;) {
				op = here >>> 24;
				hold >>>= op;
				bits -= op;
				op = here >>> 16 & 255;
				if (op === 0) output[_out++] = here & 65535;
				else if (op & 16) {
					len = here & 65535;
					op &= 15;
					if (op) {
						if (bits < op) {
							hold += input[_in++] << bits;
							bits += 8;
						}
						len += hold & (1 << op) - 1;
						hold >>>= op;
						bits -= op;
					}
					if (bits < 15) {
						hold += input[_in++] << bits;
						bits += 8;
						hold += input[_in++] << bits;
						bits += 8;
					}
					here = dcode[hold & dmask];
					dodist: for (;;) {
						op = here >>> 24;
						hold >>>= op;
						bits -= op;
						op = here >>> 16 & 255;
						if (op & 16) {
							dist = here & 65535;
							op &= 15;
							if (bits < op) {
								hold += input[_in++] << bits;
								bits += 8;
								if (bits < op) {
									hold += input[_in++] << bits;
									bits += 8;
								}
							}
							dist += hold & (1 << op) - 1;
							if (dist > dmax) {
								strm.msg = "invalid distance too far back";
								state.mode = BAD;
								break top;
							}
							hold >>>= op;
							bits -= op;
							op = _out - beg;
							if (dist > op) {
								op = dist - op;
								if (op > whave) {
									if (state.sane) {
										strm.msg = "invalid distance too far back";
										state.mode = BAD;
										break top;
									}
								}
								from = 0;
								from_source = s_window;
								if (wnext === 0) {
									from += wsize - op;
									if (op < len) {
										len -= op;
										do
											output[_out++] = s_window[from++];
										while (--op);
										from = _out - dist;
										from_source = output;
									}
								} else if (wnext < op) {
									from += wsize + wnext - op;
									op -= wnext;
									if (op < len) {
										len -= op;
										do
											output[_out++] = s_window[from++];
										while (--op);
										from = 0;
										if (wnext < len) {
											op = wnext;
											len -= op;
											do
												output[_out++] = s_window[from++];
											while (--op);
											from = _out - dist;
											from_source = output;
										}
									}
								} else {
									from += wnext - op;
									if (op < len) {
										len -= op;
										do
											output[_out++] = s_window[from++];
										while (--op);
										from = _out - dist;
										from_source = output;
									}
								}
								while (len > 2) {
									output[_out++] = from_source[from++];
									output[_out++] = from_source[from++];
									output[_out++] = from_source[from++];
									len -= 3;
								}
								if (len) {
									output[_out++] = from_source[from++];
									if (len > 1) output[_out++] = from_source[from++];
								}
							} else {
								from = _out - dist;
								do {
									output[_out++] = output[from++];
									output[_out++] = output[from++];
									output[_out++] = output[from++];
									len -= 3;
								} while (len > 2);
								if (len) {
									output[_out++] = output[from++];
									if (len > 1) output[_out++] = output[from++];
								}
							}
						} else if ((op & 64) === 0) {
							here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
							continue dodist;
						} else {
							strm.msg = "invalid distance code";
							state.mode = BAD;
							break top;
						}
						break;
					}
				} else if ((op & 64) === 0) {
					here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
					continue dolen;
				} else if (op & 32) {
					state.mode = TYPE;
					break top;
				} else {
					strm.msg = "invalid literal/length code";
					state.mode = BAD;
					break top;
				}
				break;
			}
		} while (_in < last && _out < end);
		len = bits >> 3;
		_in -= len;
		bits -= len << 3;
		hold &= (1 << bits) - 1;
		strm.next_in = _in;
		strm.next_out = _out;
		strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
		strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
		state.hold = hold;
		state.bits = bits;
	};
}));
// node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_common();
	var MAXBITS = 15;
	var ENOUGH_LENS = 852;
	var ENOUGH_DISTS = 592;
	var CODES = 0;
	var LENS = 1;
	var DISTS = 2;
	var lbase = [
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		13,
		15,
		17,
		19,
		23,
		27,
		31,
		35,
		43,
		51,
		59,
		67,
		83,
		99,
		115,
		131,
		163,
		195,
		227,
		258,
		0,
		0
	];
	var lext = [
		16,
		16,
		16,
		16,
		16,
		16,
		16,
		16,
		17,
		17,
		17,
		17,
		18,
		18,
		18,
		18,
		19,
		19,
		19,
		19,
		20,
		20,
		20,
		20,
		21,
		21,
		21,
		21,
		16,
		72,
		78
	];
	var dbase = [
		1,
		2,
		3,
		4,
		5,
		7,
		9,
		13,
		17,
		25,
		33,
		49,
		65,
		97,
		129,
		193,
		257,
		385,
		513,
		769,
		1025,
		1537,
		2049,
		3073,
		4097,
		6145,
		8193,
		12289,
		16385,
		24577,
		0,
		0
	];
	var dext = [
		16,
		16,
		16,
		16,
		17,
		17,
		18,
		18,
		19,
		19,
		20,
		20,
		21,
		21,
		22,
		22,
		23,
		23,
		24,
		24,
		25,
		25,
		26,
		26,
		27,
		27,
		28,
		28,
		29,
		29,
		64,
		64
	];
	module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
		var bits = opts.bits;
		var len = 0;
		var sym = 0;
		var min = 0, max = 0;
		var root = 0;
		var curr = 0;
		var drop = 0;
		var left = 0;
		var used = 0;
		var huff = 0;
		var incr;
		var fill;
		var low;
		var mask;
		var next;
		var base = null;
		var base_index = 0;
		var end;
		var count = new utils.Buf16(MAXBITS + 1);
		var offs = new utils.Buf16(MAXBITS + 1);
		var extra = null;
		var extra_index = 0;
		var here_bits, here_op, here_val;
		for (len = 0; len <= MAXBITS; len++) count[len] = 0;
		for (sym = 0; sym < codes; sym++) count[lens[lens_index + sym]]++;
		root = bits;
		for (max = MAXBITS; max >= 1; max--) if (count[max] !== 0) break;
		if (root > max) root = max;
		if (max === 0) {
			table[table_index++] = 20971520;
			table[table_index++] = 20971520;
			opts.bits = 1;
			return 0;
		}
		for (min = 1; min < max; min++) if (count[min] !== 0) break;
		if (root < min) root = min;
		left = 1;
		for (len = 1; len <= MAXBITS; len++) {
			left <<= 1;
			left -= count[len];
			if (left < 0) return -1;
		}
		if (left > 0 && (type === CODES || max !== 1)) return -1;
		offs[1] = 0;
		for (len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
		for (sym = 0; sym < codes; sym++) if (lens[lens_index + sym] !== 0) work[offs[lens[lens_index + sym]]++] = sym;
		if (type === CODES) {
			base = extra = work;
			end = 19;
		} else if (type === LENS) {
			base = lbase;
			base_index -= 257;
			extra = lext;
			extra_index -= 257;
			end = 256;
		} else {
			base = dbase;
			extra = dext;
			end = -1;
		}
		huff = 0;
		sym = 0;
		len = min;
		next = table_index;
		curr = root;
		drop = 0;
		low = -1;
		used = 1 << root;
		mask = used - 1;
		if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) return 1;
		for (;;) {
			here_bits = len - drop;
			if (work[sym] < end) {
				here_op = 0;
				here_val = work[sym];
			} else if (work[sym] > end) {
				here_op = extra[extra_index + work[sym]];
				here_val = base[base_index + work[sym]];
			} else {
				here_op = 96;
				here_val = 0;
			}
			incr = 1 << len - drop;
			fill = 1 << curr;
			min = fill;
			do {
				fill -= incr;
				table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
			} while (fill !== 0);
			incr = 1 << len - 1;
			while (huff & incr) incr >>= 1;
			if (incr !== 0) {
				huff &= incr - 1;
				huff += incr;
			} else huff = 0;
			sym++;
			if (--count[len] === 0) {
				if (len === max) break;
				len = lens[lens_index + work[sym]];
			}
			if (len > root && (huff & mask) !== low) {
				if (drop === 0) drop = root;
				next += min;
				curr = len - drop;
				left = 1 << curr;
				while (curr + drop < max) {
					left -= count[curr + drop];
					if (left <= 0) break;
					curr++;
					left <<= 1;
				}
				used += 1 << curr;
				if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) return 1;
				low = huff & mask;
				table[low] = root << 24 | curr << 16 | next - table_index | 0;
			}
		}
		if (huff !== 0) table[next + huff] = len - drop << 24 | 4194304;
		opts.bits = root;
		return 0;
	};
}));
// node_modules/pako/lib/zlib/inflate.js
var require_inflate$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utils = require_common();
	var adler32 = require_adler32();
	var crc32 = require_crc32();
	var inflate_fast = require_inffast();
	var inflate_table = require_inftrees();
	var CODES = 0;
	var LENS = 1;
	var DISTS = 2;
	var Z_FINISH = 4;
	var Z_BLOCK = 5;
	var Z_TREES = 6;
	var Z_OK = 0;
	var Z_STREAM_END = 1;
	var Z_NEED_DICT = 2;
	var Z_STREAM_ERROR = -2;
	var Z_DATA_ERROR = -3;
	var Z_MEM_ERROR = -4;
	var Z_BUF_ERROR = -5;
	var Z_DEFLATED = 8;
	var HEAD = 1;
	var FLAGS = 2;
	var TIME = 3;
	var OS = 4;
	var EXLEN = 5;
	var EXTRA = 6;
	var NAME = 7;
	var COMMENT = 8;
	var HCRC = 9;
	var DICTID = 10;
	var DICT = 11;
	var TYPE = 12;
	var TYPEDO = 13;
	var STORED = 14;
	var COPY_ = 15;
	var COPY = 16;
	var TABLE = 17;
	var LENLENS = 18;
	var CODELENS = 19;
	var LEN_ = 20;
	var LEN = 21;
	var LENEXT = 22;
	var DIST = 23;
	var DISTEXT = 24;
	var MATCH = 25;
	var LIT = 26;
	var CHECK = 27;
	var LENGTH = 28;
	var DONE = 29;
	var BAD = 30;
	var MEM = 31;
	var SYNC = 32;
	var ENOUGH_LENS = 852;
	var ENOUGH_DISTS = 592;
	var DEF_WBITS = 15;
	function zswap32(q) {
		return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
	}
	function InflateState() {
		this.mode = 0;
		this.last = false;
		this.wrap = 0;
		this.havedict = false;
		this.flags = 0;
		this.dmax = 0;
		this.check = 0;
		this.total = 0;
		this.head = null;
		this.wbits = 0;
		this.wsize = 0;
		this.whave = 0;
		this.wnext = 0;
		this.window = null;
		this.hold = 0;
		this.bits = 0;
		this.length = 0;
		this.offset = 0;
		this.extra = 0;
		this.lencode = null;
		this.distcode = null;
		this.lenbits = 0;
		this.distbits = 0;
		this.ncode = 0;
		this.nlen = 0;
		this.ndist = 0;
		this.have = 0;
		this.next = null;
		this.lens = new utils.Buf16(320);
		this.work = new utils.Buf16(288);
		this.lendyn = null;
		this.distdyn = null;
		this.sane = 0;
		this.back = 0;
		this.was = 0;
	}
	function inflateResetKeep(strm) {
		var state;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		state = strm.state;
		strm.total_in = strm.total_out = state.total = 0;
		strm.msg = "";
		if (state.wrap) strm.adler = state.wrap & 1;
		state.mode = HEAD;
		state.last = 0;
		state.havedict = 0;
		state.dmax = 32768;
		state.head = null;
		state.hold = 0;
		state.bits = 0;
		state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
		state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
		state.sane = 1;
		state.back = -1;
		return Z_OK;
	}
	function inflateReset(strm) {
		var state;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		state = strm.state;
		state.wsize = 0;
		state.whave = 0;
		state.wnext = 0;
		return inflateResetKeep(strm);
	}
	function inflateReset2(strm, windowBits) {
		var wrap;
		var state;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		state = strm.state;
		if (windowBits < 0) {
			wrap = 0;
			windowBits = -windowBits;
		} else {
			wrap = (windowBits >> 4) + 1;
			if (windowBits < 48) windowBits &= 15;
		}
		if (windowBits && (windowBits < 8 || windowBits > 15)) return Z_STREAM_ERROR;
		if (state.window !== null && state.wbits !== windowBits) state.window = null;
		state.wrap = wrap;
		state.wbits = windowBits;
		return inflateReset(strm);
	}
	function inflateInit2(strm, windowBits) {
		var ret;
		var state;
		if (!strm) return Z_STREAM_ERROR;
		state = new InflateState();
		strm.state = state;
		state.window = null;
		ret = inflateReset2(strm, windowBits);
		if (ret !== Z_OK) strm.state = null;
		return ret;
	}
	function inflateInit(strm) {
		return inflateInit2(strm, DEF_WBITS);
	}
	var virgin = true;
	var lenfix;
	var distfix;
	function fixedtables(state) {
		if (virgin) {
			var sym;
			lenfix = new utils.Buf32(512);
			distfix = new utils.Buf32(32);
			sym = 0;
			while (sym < 144) state.lens[sym++] = 8;
			while (sym < 256) state.lens[sym++] = 9;
			while (sym < 280) state.lens[sym++] = 7;
			while (sym < 288) state.lens[sym++] = 8;
			inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
			sym = 0;
			while (sym < 32) state.lens[sym++] = 5;
			inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
			virgin = false;
		}
		state.lencode = lenfix;
		state.lenbits = 9;
		state.distcode = distfix;
		state.distbits = 5;
	}
	function updatewindow(strm, src, end, copy) {
		var dist;
		var state = strm.state;
		if (state.window === null) {
			state.wsize = 1 << state.wbits;
			state.wnext = 0;
			state.whave = 0;
			state.window = new utils.Buf8(state.wsize);
		}
		if (copy >= state.wsize) {
			utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
			state.wnext = 0;
			state.whave = state.wsize;
		} else {
			dist = state.wsize - state.wnext;
			if (dist > copy) dist = copy;
			utils.arraySet(state.window, src, end - copy, dist, state.wnext);
			copy -= dist;
			if (copy) {
				utils.arraySet(state.window, src, end - copy, copy, 0);
				state.wnext = copy;
				state.whave = state.wsize;
			} else {
				state.wnext += dist;
				if (state.wnext === state.wsize) state.wnext = 0;
				if (state.whave < state.wsize) state.whave += dist;
			}
		}
		return 0;
	}
	function inflate(strm, flush) {
		var state;
		var input, output;
		var next;
		var put;
		var have, left;
		var hold;
		var bits;
		var _in, _out;
		var copy;
		var from;
		var from_source;
		var here = 0;
		var here_bits, here_op, here_val;
		var last_bits, last_op, last_val;
		var len;
		var ret;
		var hbuf = new utils.Buf8(4);
		var opts;
		var n;
		var order = [
			16,
			17,
			18,
			0,
			8,
			7,
			9,
			6,
			10,
			5,
			11,
			4,
			12,
			3,
			13,
			2,
			14,
			1,
			15
		];
		if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) return Z_STREAM_ERROR;
		state = strm.state;
		if (state.mode === TYPE) state.mode = TYPEDO;
		put = strm.next_out;
		output = strm.output;
		left = strm.avail_out;
		next = strm.next_in;
		input = strm.input;
		have = strm.avail_in;
		hold = state.hold;
		bits = state.bits;
		_in = have;
		_out = left;
		ret = Z_OK;
		inf_leave: for (;;) switch (state.mode) {
			case HEAD:
				if (state.wrap === 0) {
					state.mode = TYPEDO;
					break;
				}
				while (bits < 16) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if (state.wrap & 2 && hold === 35615) {
					state.check = 0;
					hbuf[0] = hold & 255;
					hbuf[1] = hold >>> 8 & 255;
					state.check = crc32(state.check, hbuf, 2, 0);
					hold = 0;
					bits = 0;
					state.mode = FLAGS;
					break;
				}
				state.flags = 0;
				if (state.head) state.head.done = false;
				if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
					strm.msg = "incorrect header check";
					state.mode = BAD;
					break;
				}
				if ((hold & 15) !== Z_DEFLATED) {
					strm.msg = "unknown compression method";
					state.mode = BAD;
					break;
				}
				hold >>>= 4;
				bits -= 4;
				len = (hold & 15) + 8;
				if (state.wbits === 0) state.wbits = len;
				else if (len > state.wbits) {
					strm.msg = "invalid window size";
					state.mode = BAD;
					break;
				}
				state.dmax = 1 << len;
				strm.adler = state.check = 1;
				state.mode = hold & 512 ? DICTID : TYPE;
				hold = 0;
				bits = 0;
				break;
			case FLAGS:
				while (bits < 16) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				state.flags = hold;
				if ((state.flags & 255) !== Z_DEFLATED) {
					strm.msg = "unknown compression method";
					state.mode = BAD;
					break;
				}
				if (state.flags & 57344) {
					strm.msg = "unknown header flags set";
					state.mode = BAD;
					break;
				}
				if (state.head) state.head.text = hold >> 8 & 1;
				if (state.flags & 512) {
					hbuf[0] = hold & 255;
					hbuf[1] = hold >>> 8 & 255;
					state.check = crc32(state.check, hbuf, 2, 0);
				}
				hold = 0;
				bits = 0;
				state.mode = TIME;
			case TIME:
				while (bits < 32) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if (state.head) state.head.time = hold;
				if (state.flags & 512) {
					hbuf[0] = hold & 255;
					hbuf[1] = hold >>> 8 & 255;
					hbuf[2] = hold >>> 16 & 255;
					hbuf[3] = hold >>> 24 & 255;
					state.check = crc32(state.check, hbuf, 4, 0);
				}
				hold = 0;
				bits = 0;
				state.mode = OS;
			case OS:
				while (bits < 16) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if (state.head) {
					state.head.xflags = hold & 255;
					state.head.os = hold >> 8;
				}
				if (state.flags & 512) {
					hbuf[0] = hold & 255;
					hbuf[1] = hold >>> 8 & 255;
					state.check = crc32(state.check, hbuf, 2, 0);
				}
				hold = 0;
				bits = 0;
				state.mode = EXLEN;
			case EXLEN:
				if (state.flags & 1024) {
					while (bits < 16) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					state.length = hold;
					if (state.head) state.head.extra_len = hold;
					if (state.flags & 512) {
						hbuf[0] = hold & 255;
						hbuf[1] = hold >>> 8 & 255;
						state.check = crc32(state.check, hbuf, 2, 0);
					}
					hold = 0;
					bits = 0;
				} else if (state.head) state.head.extra = null;
				state.mode = EXTRA;
			case EXTRA:
				if (state.flags & 1024) {
					copy = state.length;
					if (copy > have) copy = have;
					if (copy) {
						if (state.head) {
							len = state.head.extra_len - state.length;
							if (!state.head.extra) state.head.extra = new Array(state.head.extra_len);
							utils.arraySet(state.head.extra, input, next, copy, len);
						}
						if (state.flags & 512) state.check = crc32(state.check, input, copy, next);
						have -= copy;
						next += copy;
						state.length -= copy;
					}
					if (state.length) break inf_leave;
				}
				state.length = 0;
				state.mode = NAME;
			case NAME:
				if (state.flags & 2048) {
					if (have === 0) break inf_leave;
					copy = 0;
					do {
						len = input[next + copy++];
						if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
					} while (len && copy < have);
					if (state.flags & 512) state.check = crc32(state.check, input, copy, next);
					have -= copy;
					next += copy;
					if (len) break inf_leave;
				} else if (state.head) state.head.name = null;
				state.length = 0;
				state.mode = COMMENT;
			case COMMENT:
				if (state.flags & 4096) {
					if (have === 0) break inf_leave;
					copy = 0;
					do {
						len = input[next + copy++];
						if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
					} while (len && copy < have);
					if (state.flags & 512) state.check = crc32(state.check, input, copy, next);
					have -= copy;
					next += copy;
					if (len) break inf_leave;
				} else if (state.head) state.head.comment = null;
				state.mode = HCRC;
			case HCRC:
				if (state.flags & 512) {
					while (bits < 16) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					if (hold !== (state.check & 65535)) {
						strm.msg = "header crc mismatch";
						state.mode = BAD;
						break;
					}
					hold = 0;
					bits = 0;
				}
				if (state.head) {
					state.head.hcrc = state.flags >> 9 & 1;
					state.head.done = true;
				}
				strm.adler = state.check = 0;
				state.mode = TYPE;
				break;
			case DICTID:
				while (bits < 32) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				strm.adler = state.check = zswap32(hold);
				hold = 0;
				bits = 0;
				state.mode = DICT;
			case DICT:
				if (state.havedict === 0) {
					strm.next_out = put;
					strm.avail_out = left;
					strm.next_in = next;
					strm.avail_in = have;
					state.hold = hold;
					state.bits = bits;
					return Z_NEED_DICT;
				}
				strm.adler = state.check = 1;
				state.mode = TYPE;
			case TYPE: if (flush === Z_BLOCK || flush === Z_TREES) break inf_leave;
			case TYPEDO:
				if (state.last) {
					hold >>>= bits & 7;
					bits -= bits & 7;
					state.mode = CHECK;
					break;
				}
				while (bits < 3) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				state.last = hold & 1;
				hold >>>= 1;
				bits -= 1;
				switch (hold & 3) {
					case 0:
						state.mode = STORED;
						break;
					case 1:
						fixedtables(state);
						state.mode = LEN_;
						if (flush === Z_TREES) {
							hold >>>= 2;
							bits -= 2;
							break inf_leave;
						}
						break;
					case 2:
						state.mode = TABLE;
						break;
					case 3:
						strm.msg = "invalid block type";
						state.mode = BAD;
				}
				hold >>>= 2;
				bits -= 2;
				break;
			case STORED:
				hold >>>= bits & 7;
				bits -= bits & 7;
				while (bits < 32) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
					strm.msg = "invalid stored block lengths";
					state.mode = BAD;
					break;
				}
				state.length = hold & 65535;
				hold = 0;
				bits = 0;
				state.mode = COPY_;
				if (flush === Z_TREES) break inf_leave;
			case COPY_: state.mode = COPY;
			case COPY:
				copy = state.length;
				if (copy) {
					if (copy > have) copy = have;
					if (copy > left) copy = left;
					if (copy === 0) break inf_leave;
					utils.arraySet(output, input, next, copy, put);
					have -= copy;
					next += copy;
					left -= copy;
					put += copy;
					state.length -= copy;
					break;
				}
				state.mode = TYPE;
				break;
			case TABLE:
				while (bits < 14) {
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				state.nlen = (hold & 31) + 257;
				hold >>>= 5;
				bits -= 5;
				state.ndist = (hold & 31) + 1;
				hold >>>= 5;
				bits -= 5;
				state.ncode = (hold & 15) + 4;
				hold >>>= 4;
				bits -= 4;
				if (state.nlen > 286 || state.ndist > 30) {
					strm.msg = "too many length or distance symbols";
					state.mode = BAD;
					break;
				}
				state.have = 0;
				state.mode = LENLENS;
			case LENLENS:
				while (state.have < state.ncode) {
					while (bits < 3) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					state.lens[order[state.have++]] = hold & 7;
					hold >>>= 3;
					bits -= 3;
				}
				while (state.have < 19) state.lens[order[state.have++]] = 0;
				state.lencode = state.lendyn;
				state.lenbits = 7;
				opts = { bits: state.lenbits };
				ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
				state.lenbits = opts.bits;
				if (ret) {
					strm.msg = "invalid code lengths set";
					state.mode = BAD;
					break;
				}
				state.have = 0;
				state.mode = CODELENS;
			case CODELENS:
				while (state.have < state.nlen + state.ndist) {
					for (;;) {
						here = state.lencode[hold & (1 << state.lenbits) - 1];
						here_bits = here >>> 24;
						here_op = here >>> 16 & 255;
						here_val = here & 65535;
						if (here_bits <= bits) break;
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					if (here_val < 16) {
						hold >>>= here_bits;
						bits -= here_bits;
						state.lens[state.have++] = here_val;
					} else {
						if (here_val === 16) {
							n = here_bits + 2;
							while (bits < n) {
								if (have === 0) break inf_leave;
								have--;
								hold += input[next++] << bits;
								bits += 8;
							}
							hold >>>= here_bits;
							bits -= here_bits;
							if (state.have === 0) {
								strm.msg = "invalid bit length repeat";
								state.mode = BAD;
								break;
							}
							len = state.lens[state.have - 1];
							copy = 3 + (hold & 3);
							hold >>>= 2;
							bits -= 2;
						} else if (here_val === 17) {
							n = here_bits + 3;
							while (bits < n) {
								if (have === 0) break inf_leave;
								have--;
								hold += input[next++] << bits;
								bits += 8;
							}
							hold >>>= here_bits;
							bits -= here_bits;
							len = 0;
							copy = 3 + (hold & 7);
							hold >>>= 3;
							bits -= 3;
						} else {
							n = here_bits + 7;
							while (bits < n) {
								if (have === 0) break inf_leave;
								have--;
								hold += input[next++] << bits;
								bits += 8;
							}
							hold >>>= here_bits;
							bits -= here_bits;
							len = 0;
							copy = 11 + (hold & 127);
							hold >>>= 7;
							bits -= 7;
						}
						if (state.have + copy > state.nlen + state.ndist) {
							strm.msg = "invalid bit length repeat";
							state.mode = BAD;
							break;
						}
						while (copy--) state.lens[state.have++] = len;
					}
				}
				if (state.mode === BAD) break;
				if (state.lens[256] === 0) {
					strm.msg = "invalid code -- missing end-of-block";
					state.mode = BAD;
					break;
				}
				state.lenbits = 9;
				opts = { bits: state.lenbits };
				ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
				state.lenbits = opts.bits;
				if (ret) {
					strm.msg = "invalid literal/lengths set";
					state.mode = BAD;
					break;
				}
				state.distbits = 6;
				state.distcode = state.distdyn;
				opts = { bits: state.distbits };
				ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
				state.distbits = opts.bits;
				if (ret) {
					strm.msg = "invalid distances set";
					state.mode = BAD;
					break;
				}
				state.mode = LEN_;
				if (flush === Z_TREES) break inf_leave;
			case LEN_: state.mode = LEN;
			case LEN:
				if (have >= 6 && left >= 258) {
					strm.next_out = put;
					strm.avail_out = left;
					strm.next_in = next;
					strm.avail_in = have;
					state.hold = hold;
					state.bits = bits;
					inflate_fast(strm, _out);
					put = strm.next_out;
					output = strm.output;
					left = strm.avail_out;
					next = strm.next_in;
					input = strm.input;
					have = strm.avail_in;
					hold = state.hold;
					bits = state.bits;
					if (state.mode === TYPE) state.back = -1;
					break;
				}
				state.back = 0;
				for (;;) {
					here = state.lencode[hold & (1 << state.lenbits) - 1];
					here_bits = here >>> 24;
					here_op = here >>> 16 & 255;
					here_val = here & 65535;
					if (here_bits <= bits) break;
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if (here_op && (here_op & 240) === 0) {
					last_bits = here_bits;
					last_op = here_op;
					last_val = here_val;
					for (;;) {
						here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
						here_bits = here >>> 24;
						here_op = here >>> 16 & 255;
						here_val = here & 65535;
						if (last_bits + here_bits <= bits) break;
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					hold >>>= last_bits;
					bits -= last_bits;
					state.back += last_bits;
				}
				hold >>>= here_bits;
				bits -= here_bits;
				state.back += here_bits;
				state.length = here_val;
				if (here_op === 0) {
					state.mode = LIT;
					break;
				}
				if (here_op & 32) {
					state.back = -1;
					state.mode = TYPE;
					break;
				}
				if (here_op & 64) {
					strm.msg = "invalid literal/length code";
					state.mode = BAD;
					break;
				}
				state.extra = here_op & 15;
				state.mode = LENEXT;
			case LENEXT:
				if (state.extra) {
					n = state.extra;
					while (bits < n) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					state.length += hold & (1 << state.extra) - 1;
					hold >>>= state.extra;
					bits -= state.extra;
					state.back += state.extra;
				}
				state.was = state.length;
				state.mode = DIST;
			case DIST:
				for (;;) {
					here = state.distcode[hold & (1 << state.distbits) - 1];
					here_bits = here >>> 24;
					here_op = here >>> 16 & 255;
					here_val = here & 65535;
					if (here_bits <= bits) break;
					if (have === 0) break inf_leave;
					have--;
					hold += input[next++] << bits;
					bits += 8;
				}
				if ((here_op & 240) === 0) {
					last_bits = here_bits;
					last_op = here_op;
					last_val = here_val;
					for (;;) {
						here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
						here_bits = here >>> 24;
						here_op = here >>> 16 & 255;
						here_val = here & 65535;
						if (last_bits + here_bits <= bits) break;
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					hold >>>= last_bits;
					bits -= last_bits;
					state.back += last_bits;
				}
				hold >>>= here_bits;
				bits -= here_bits;
				state.back += here_bits;
				if (here_op & 64) {
					strm.msg = "invalid distance code";
					state.mode = BAD;
					break;
				}
				state.offset = here_val;
				state.extra = here_op & 15;
				state.mode = DISTEXT;
			case DISTEXT:
				if (state.extra) {
					n = state.extra;
					while (bits < n) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					state.offset += hold & (1 << state.extra) - 1;
					hold >>>= state.extra;
					bits -= state.extra;
					state.back += state.extra;
				}
				if (state.offset > state.dmax) {
					strm.msg = "invalid distance too far back";
					state.mode = BAD;
					break;
				}
				state.mode = MATCH;
			case MATCH:
				if (left === 0) break inf_leave;
				copy = _out - left;
				if (state.offset > copy) {
					copy = state.offset - copy;
					if (copy > state.whave) {
						if (state.sane) {
							strm.msg = "invalid distance too far back";
							state.mode = BAD;
							break;
						}
					}
					if (copy > state.wnext) {
						copy -= state.wnext;
						from = state.wsize - copy;
					} else from = state.wnext - copy;
					if (copy > state.length) copy = state.length;
					from_source = state.window;
				} else {
					from_source = output;
					from = put - state.offset;
					copy = state.length;
				}
				if (copy > left) copy = left;
				left -= copy;
				state.length -= copy;
				do
					output[put++] = from_source[from++];
				while (--copy);
				if (state.length === 0) state.mode = LEN;
				break;
			case LIT:
				if (left === 0) break inf_leave;
				output[put++] = state.length;
				left--;
				state.mode = LEN;
				break;
			case CHECK:
				if (state.wrap) {
					while (bits < 32) {
						if (have === 0) break inf_leave;
						have--;
						hold |= input[next++] << bits;
						bits += 8;
					}
					_out -= left;
					strm.total_out += _out;
					state.total += _out;
					if (_out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
					_out = left;
					if ((state.flags ? hold : zswap32(hold)) !== state.check) {
						strm.msg = "incorrect data check";
						state.mode = BAD;
						break;
					}
					hold = 0;
					bits = 0;
				}
				state.mode = LENGTH;
			case LENGTH:
				if (state.wrap && state.flags) {
					while (bits < 32) {
						if (have === 0) break inf_leave;
						have--;
						hold += input[next++] << bits;
						bits += 8;
					}
					if (hold !== (state.total & 4294967295)) {
						strm.msg = "incorrect length check";
						state.mode = BAD;
						break;
					}
					hold = 0;
					bits = 0;
				}
				state.mode = DONE;
			case DONE:
				ret = Z_STREAM_END;
				break inf_leave;
			case BAD:
				ret = Z_DATA_ERROR;
				break inf_leave;
			case MEM: return Z_MEM_ERROR;
			case SYNC:
			default: return Z_STREAM_ERROR;
		}
		strm.next_out = put;
		strm.avail_out = left;
		strm.next_in = next;
		strm.avail_in = have;
		state.hold = hold;
		state.bits = bits;
		if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
			if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
				state.mode = MEM;
				return Z_MEM_ERROR;
			}
		}
		_in -= strm.avail_in;
		_out -= strm.avail_out;
		strm.total_in += _in;
		strm.total_out += _out;
		state.total += _out;
		if (state.wrap && _out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
		strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
		if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) ret = Z_BUF_ERROR;
		return ret;
	}
	function inflateEnd(strm) {
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		var state = strm.state;
		if (state.window) state.window = null;
		strm.state = null;
		return Z_OK;
	}
	function inflateGetHeader(strm, head) {
		var state;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		state = strm.state;
		if ((state.wrap & 2) === 0) return Z_STREAM_ERROR;
		state.head = head;
		head.done = false;
		return Z_OK;
	}
	function inflateSetDictionary(strm, dictionary) {
		var dictLength = dictionary.length;
		var state;
		var dictid;
		var ret;
		if (!strm || !strm.state) return Z_STREAM_ERROR;
		state = strm.state;
		if (state.wrap !== 0 && state.mode !== DICT) return Z_STREAM_ERROR;
		if (state.mode === DICT) {
			dictid = 1;
			dictid = adler32(dictid, dictionary, dictLength, 0);
			if (dictid !== state.check) return Z_DATA_ERROR;
		}
		ret = updatewindow(strm, dictionary, dictLength, dictLength);
		if (ret) {
			state.mode = MEM;
			return Z_MEM_ERROR;
		}
		state.havedict = 1;
		return Z_OK;
	}
	exports.inflateReset = inflateReset;
	exports.inflateReset2 = inflateReset2;
	exports.inflateResetKeep = inflateResetKeep;
	exports.inflateInit = inflateInit;
	exports.inflateInit2 = inflateInit2;
	exports.inflate = inflate;
	exports.inflateEnd = inflateEnd;
	exports.inflateGetHeader = inflateGetHeader;
	exports.inflateSetDictionary = inflateSetDictionary;
	exports.inflateInfo = "pako inflate (from Nodeca project)";
}));
// node_modules/pako/lib/zlib/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		Z_NO_FLUSH: 0,
		Z_PARTIAL_FLUSH: 1,
		Z_SYNC_FLUSH: 2,
		Z_FULL_FLUSH: 3,
		Z_FINISH: 4,
		Z_BLOCK: 5,
		Z_TREES: 6,
		Z_OK: 0,
		Z_STREAM_END: 1,
		Z_NEED_DICT: 2,
		Z_ERRNO: -1,
		Z_STREAM_ERROR: -2,
		Z_DATA_ERROR: -3,
		Z_BUF_ERROR: -5,
		Z_NO_COMPRESSION: 0,
		Z_BEST_SPEED: 1,
		Z_BEST_COMPRESSION: 9,
		Z_DEFAULT_COMPRESSION: -1,
		Z_FILTERED: 1,
		Z_HUFFMAN_ONLY: 2,
		Z_RLE: 3,
		Z_FIXED: 4,
		Z_DEFAULT_STRATEGY: 0,
		Z_BINARY: 0,
		Z_TEXT: 1,
		Z_UNKNOWN: 2,
		Z_DEFLATED: 8
	};
}));
// node_modules/pako/lib/zlib/gzheader.js
var require_gzheader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function GZheader() {
		this.text = 0;
		this.time = 0;
		this.xflags = 0;
		this.os = 0;
		this.extra = null;
		this.extra_len = 0;
		this.name = "";
		this.comment = "";
		this.hcrc = 0;
		this.done = false;
	}
	module.exports = GZheader;
}));
// node_modules/pako/lib/inflate.js
var require_inflate = /* @__PURE__ */ __commonJSMin(((exports) => {
	var zlib_inflate = require_inflate$1();
	var utils = require_common();
	var strings = require_strings();
	var c = require_constants();
	var msg = require_messages();
	var ZStream = require_zstream();
	var GZheader = require_gzheader();
	var toString = Object.prototype.toString;
	/**
	* class Inflate
	*
	* Generic JS-style wrapper for zlib calls. If you don't need
	* streaming behaviour - use more simple functions: [[inflate]]
	* and [[inflateRaw]].
	**/
	/**
	* Inflate.result -> Uint8Array|Array|String
	*
	* Uncompressed result, generated by default [[Inflate#onData]]
	* and [[Inflate#onEnd]] handlers. Filled after you push last chunk
	* (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
	* push a chunk with explicit flush (call [[Inflate#push]] with
	* `Z_SYNC_FLUSH` param).
	**/
	/**
	* Inflate.err -> Number
	*
	* Error code after inflate finished. 0 (Z_OK) on success.
	* Should be checked if broken data possible.
	**/
	/**
	* Inflate.msg -> String
	*
	* Error message, if [[Inflate.err]] != 0
	**/
	/**
	* new Inflate(options)
	* - options (Object): zlib inflate options.
	*
	* Creates new inflator instance with specified params. Throws exception
	* on bad params. Supported options:
	*
	* - `windowBits`
	* - `dictionary`
	*
	* [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
	* for more information on these.
	*
	* Additional options, for internal needs:
	*
	* - `chunkSize` - size of generated data chunks (16K by default)
	* - `raw` (Boolean) - do raw inflate
	* - `to` (String) - if equal to 'string', then result will be converted
	*   from utf8 to utf16 (javascript) string. When string output requested,
	*   chunk length can differ from `chunkSize`, depending on content.
	*
	* By default, when no options set, autodetect deflate/gzip data format via
	* wrapper header.
	*
	* ##### Example:
	*
	* ```javascript
	* var pako = require('pako')
	*   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
	*   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
	*
	* var inflate = new pako.Inflate({ level: 3});
	*
	* inflate.push(chunk1, false);
	* inflate.push(chunk2, true);  // true -> last chunk
	*
	* if (inflate.err) { throw new Error(inflate.err); }
	*
	* console.log(inflate.result);
	* ```
	**/
	function Inflate(options) {
		if (!(this instanceof Inflate)) return new Inflate(options);
		this.options = utils.assign({
			chunkSize: 16384,
			windowBits: 0,
			to: ""
		}, options || {});
		var opt = this.options;
		if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
			opt.windowBits = -opt.windowBits;
			if (opt.windowBits === 0) opt.windowBits = -15;
		}
		if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) opt.windowBits += 32;
		if (opt.windowBits > 15 && opt.windowBits < 48) {
			if ((opt.windowBits & 15) === 0) opt.windowBits |= 15;
		}
		this.err = 0;
		this.msg = "";
		this.ended = false;
		this.chunks = [];
		this.strm = new ZStream();
		this.strm.avail_out = 0;
		var status = zlib_inflate.inflateInit2(this.strm, opt.windowBits);
		if (status !== c.Z_OK) throw new Error(msg[status]);
		this.header = new GZheader();
		zlib_inflate.inflateGetHeader(this.strm, this.header);
		if (opt.dictionary) {
			if (typeof opt.dictionary === "string") opt.dictionary = strings.string2buf(opt.dictionary);
			else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
			if (opt.raw) {
				status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
				if (status !== c.Z_OK) throw new Error(msg[status]);
			}
		}
	}
	/**
	* Inflate#push(data[, mode]) -> Boolean
	* - data (Uint8Array|Array|ArrayBuffer|String): input data
	* - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
	*   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
	*
	* Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
	* new output chunks. Returns `true` on success. The last data block must have
	* mode Z_FINISH (or `true`). That will flush internal pending buffers and call
	* [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
	* can use mode Z_SYNC_FLUSH, keeping the decompression context.
	*
	* On fail call [[Inflate#onEnd]] with error code and return false.
	*
	* We strongly recommend to use `Uint8Array` on input for best speed (output
	* format is detected automatically). Also, don't skip last param and always
	* use the same type in your code (boolean or number). That will improve JS speed.
	*
	* For regular `Array`-s make sure all elements are [0..255].
	*
	* ##### Example
	*
	* ```javascript
	* push(chunk, false); // push one of data chunks
	* ...
	* push(chunk, true);  // push last chunk
	* ```
	**/
	Inflate.prototype.push = function(data, mode) {
		var strm = this.strm;
		var chunkSize = this.options.chunkSize;
		var dictionary = this.options.dictionary;
		var status, _mode;
		var next_out_utf8, tail, utf8str;
		var allowBufError = false;
		if (this.ended) return false;
		_mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
		if (typeof data === "string") strm.input = strings.binstring2buf(data);
		else if (toString.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
		else strm.input = data;
		strm.next_in = 0;
		strm.avail_in = strm.input.length;
		do {
			if (strm.avail_out === 0) {
				strm.output = new utils.Buf8(chunkSize);
				strm.next_out = 0;
				strm.avail_out = chunkSize;
			}
			status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
			if (status === c.Z_NEED_DICT && dictionary) status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
			if (status === c.Z_BUF_ERROR && allowBufError === true) {
				status = c.Z_OK;
				allowBufError = false;
			}
			if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
				this.onEnd(status);
				this.ended = true;
				return false;
			}
			if (strm.next_out) {
				if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
					if (this.options.to === "string") {
						next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
						tail = strm.next_out - next_out_utf8;
						utf8str = strings.buf2string(strm.output, next_out_utf8);
						strm.next_out = tail;
						strm.avail_out = chunkSize - tail;
						if (tail) utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
						this.onData(utf8str);
					} else this.onData(utils.shrinkBuf(strm.output, strm.next_out));
				}
			}
			if (strm.avail_in === 0 && strm.avail_out === 0) allowBufError = true;
		} while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
		if (status === c.Z_STREAM_END) _mode = c.Z_FINISH;
		if (_mode === c.Z_FINISH) {
			status = zlib_inflate.inflateEnd(this.strm);
			this.onEnd(status);
			this.ended = true;
			return status === c.Z_OK;
		}
		if (_mode === c.Z_SYNC_FLUSH) {
			this.onEnd(c.Z_OK);
			strm.avail_out = 0;
			return true;
		}
		return true;
	};
	/**
	* Inflate#onData(chunk) -> Void
	* - chunk (Uint8Array|Array|String): output data. Type of array depends
	*   on js engine support. When string output requested, each chunk
	*   will be string.
	*
	* By default, stores data blocks in `chunks[]` property and glue
	* those in `onEnd`. Override this handler, if you need another behaviour.
	**/
	Inflate.prototype.onData = function(chunk) {
		this.chunks.push(chunk);
	};
	/**
	* Inflate#onEnd(status) -> Void
	* - status (Number): inflate status. 0 (Z_OK) on success,
	*   other if not.
	*
	* Called either after you tell inflate that the input stream is
	* complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
	* or if an error happened. By default - join collected chunks,
	* free memory and fill `results` / `err` properties.
	**/
	Inflate.prototype.onEnd = function(status) {
		if (status === c.Z_OK) {
			if (this.options.to === "string") this.result = this.chunks.join("");
			else this.result = utils.flattenChunks(this.chunks);
		}
		this.chunks = [];
		this.err = status;
		this.msg = this.strm.msg;
	};
	/**
	* inflate(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to decompress.
	* - options (Object): zlib inflate options.
	*
	* Decompress `data` with inflate/ungzip and `options`. Autodetect
	* format via wrapper header by default. That's why we don't provide
	* separate `ungzip` method.
	*
	* Supported options are:
	*
	* - windowBits
	*
	* [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
	* for more information.
	*
	* Sugar (options):
	*
	* - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
	*   negative windowBits implicitly.
	* - `to` (String) - if equal to 'string', then result will be converted
	*   from utf8 to utf16 (javascript) string. When string output requested,
	*   chunk length can differ from `chunkSize`, depending on content.
	*
	*
	* ##### Example:
	*
	* ```javascript
	* var pako = require('pako')
	*   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
	*   , output;
	*
	* try {
	*   output = pako.inflate(input);
	* } catch (err)
	*   console.log(err);
	* }
	* ```
	**/
	function inflate(input, options) {
		var inflator = new Inflate(options);
		inflator.push(input, true);
		if (inflator.err) throw inflator.msg || msg[inflator.err];
		return inflator.result;
	}
	/**
	* inflateRaw(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to decompress.
	* - options (Object): zlib inflate options.
	*
	* The same as [[inflate]], but creates raw data, without wrapper
	* (header and adler32 crc).
	**/
	function inflateRaw(input, options) {
		options = options || {};
		options.raw = true;
		return inflate(input, options);
	}
	/**
	* ungzip(data[, options]) -> Uint8Array|Array|String
	* - data (Uint8Array|Array|String): input data to decompress.
	* - options (Object): zlib inflate options.
	*
	* Just shortcut to [[inflate]], because it autodetects format
	* by header.content. Done for convenience.
	**/
	exports.Inflate = Inflate;
	exports.inflate = inflate;
	exports.inflateRaw = inflateRaw;
	exports.ungzip = inflate;
}));
// node_modules/pako/index.js
var require_pako = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var assign = require_common().assign;
	var deflate = require_deflate();
	var inflate = require_inflate();
	var constants = require_constants();
	var pako = {};
	assign(pako, deflate, inflate, constants);
	module.exports = pako;
}));
// node_modules/jszip/lib/flate.js
var require_flate = /* @__PURE__ */ __commonJSMin(((exports) => {
	var USE_TYPEDARRAY = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Uint32Array !== "undefined";
	var pako = require_pako();
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";
	exports.magic = "\b\0";
	/**
	* Create a worker that uses pako to inflate/deflate.
	* @constructor
	* @param {String} action the name of the pako function to call : either "Deflate" or "Inflate".
	* @param {Object} options the options to use when (de)compressing.
	*/
	function FlateWorker(action, options) {
		GenericWorker.call(this, "FlateWorker/" + action);
		this._pako = null;
		this._pakoAction = action;
		this._pakoOptions = options;
		this.meta = {};
	}
	utils.inherits(FlateWorker, GenericWorker);
	/**
	* @see GenericWorker.processChunk
	*/
	FlateWorker.prototype.processChunk = function(chunk) {
		this.meta = chunk.meta;
		if (this._pako === null) this._createPako();
		this._pako.push(utils.transformTo(ARRAY_TYPE, chunk.data), false);
	};
	/**
	* @see GenericWorker.flush
	*/
	FlateWorker.prototype.flush = function() {
		GenericWorker.prototype.flush.call(this);
		if (this._pako === null) this._createPako();
		this._pako.push([], true);
	};
	/**
	* @see GenericWorker.cleanUp
	*/
	FlateWorker.prototype.cleanUp = function() {
		GenericWorker.prototype.cleanUp.call(this);
		this._pako = null;
	};
	/**
	* Create the _pako object.
	* TODO: lazy-loading this object isn't the best solution but it's the
	* quickest. The best solution is to lazy-load the worker list. See also the
	* issue #446.
	*/
	FlateWorker.prototype._createPako = function() {
		this._pako = new pako[this._pakoAction]({
			raw: true,
			level: this._pakoOptions.level || -1
		});
		var self = this;
		this._pako.onData = function(data) {
			self.push({
				data,
				meta: self.meta
			});
		};
	};
	exports.compressWorker = function(compressionOptions) {
		return new FlateWorker("Deflate", compressionOptions);
	};
	exports.uncompressWorker = function() {
		return new FlateWorker("Inflate", {});
	};
}));
// node_modules/jszip/lib/compressions.js
var require_compressions = /* @__PURE__ */ __commonJSMin(((exports) => {
	var GenericWorker = require_GenericWorker();
	exports.STORE = {
		magic: "\0\0",
		compressWorker: function() {
			return new GenericWorker("STORE compression");
		},
		uncompressWorker: function() {
			return new GenericWorker("STORE decompression");
		}
	};
	exports.DEFLATE = require_flate();
}));
// node_modules/jszip/lib/signature.js
var require_signature = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.LOCAL_FILE_HEADER = "PK";
	exports.CENTRAL_FILE_HEADER = "PK";
	exports.CENTRAL_DIRECTORY_END = "PK";
	exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07";
	exports.ZIP64_CENTRAL_DIRECTORY_END = "PK";
	exports.DATA_DESCRIPTOR = "PK\x07\b";
}));
// node_modules/jszip/lib/generate/ZipFileWorker.js
var require_ZipFileWorker = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	var utf8 = require_utf8();
	var crc32 = require_crc32$1();
	var signature = require_signature();
	/**
	* Transform an integer into a string in hexadecimal.
	* @private
	* @param {number} dec the number to convert.
	* @param {number} bytes the number of bytes to generate.
	* @returns {string} the result.
	*/
	var decToHex = function(dec, bytes) {
		var hex = "", i = 0;
		for (; i < bytes; i++) {
			hex += String.fromCharCode(dec & 255);
			dec = dec >>> 8;
		}
		return hex;
	};
	/**
	* Generate the UNIX part of the external file attributes.
	* @param {Object} unixPermissions the unix permissions or null.
	* @param {Boolean} isDir true if the entry is a directory, false otherwise.
	* @return {Number} a 32 bit integer.
	*
	* adapted from http://unix.stackexchange.com/questions/14705/the-zip-formats-external-file-attribute :
	*
	* TTTTsstrwxrwxrwx0000000000ADVSHR
	* ^^^^____________________________ file type, see zipinfo.c (UNX_*)
	*     ^^^_________________________ setuid, setgid, sticky
	*        ^^^^^^^^^________________ permissions
	*                 ^^^^^^^^^^______ not used ?
	*                           ^^^^^^ DOS attribute bits : Archive, Directory, Volume label, System file, Hidden, Read only
	*/
	var generateUnixExternalFileAttr = function(unixPermissions, isDir) {
		var result = unixPermissions;
		if (!unixPermissions) result = isDir ? 16893 : 33204;
		return (result & 65535) << 16;
	};
	/**
	* Generate the DOS part of the external file attributes.
	* @param {Object} dosPermissions the dos permissions or null.
	* @param {Boolean} isDir true if the entry is a directory, false otherwise.
	* @return {Number} a 32 bit integer.
	*
	* Bit 0     Read-Only
	* Bit 1     Hidden
	* Bit 2     System
	* Bit 3     Volume Label
	* Bit 4     Directory
	* Bit 5     Archive
	*/
	var generateDosExternalFileAttr = function(dosPermissions) {
		return (dosPermissions || 0) & 63;
	};
	/**
	* Generate the various parts used in the construction of the final zip file.
	* @param {Object} streamInfo the hash with information about the compressed file.
	* @param {Boolean} streamedContent is the content streamed ?
	* @param {Boolean} streamingEnded is the stream finished ?
	* @param {number} offset the current offset from the start of the zip file.
	* @param {String} platform let's pretend we are this platform (change platform dependents fields)
	* @param {Function} encodeFileName the function to encode the file name / comment.
	* @return {Object} the zip parts.
	*/
	var generateZipParts = function(streamInfo, streamedContent, streamingEnded, offset, platform, encodeFileName) {
		var file = streamInfo["file"], compression = streamInfo["compression"], useCustomEncoding = encodeFileName !== utf8.utf8encode, encodedFileName = utils.transformTo("string", encodeFileName(file.name)), utfEncodedFileName = utils.transformTo("string", utf8.utf8encode(file.name)), comment = file.comment, encodedComment = utils.transformTo("string", encodeFileName(comment)), utfEncodedComment = utils.transformTo("string", utf8.utf8encode(comment)), useUTF8ForFileName = utfEncodedFileName.length !== file.name.length, useUTF8ForComment = utfEncodedComment.length !== comment.length, dosTime, dosDate, extraFields = "", unicodePathExtraField = "", unicodeCommentExtraField = "", dir = file.dir, date = file.date;
		var dataInfo = {
			crc32: 0,
			compressedSize: 0,
			uncompressedSize: 0
		};
		if (!streamedContent || streamingEnded) {
			dataInfo.crc32 = streamInfo["crc32"];
			dataInfo.compressedSize = streamInfo["compressedSize"];
			dataInfo.uncompressedSize = streamInfo["uncompressedSize"];
		}
		var bitflag = 0;
		if (streamedContent) bitflag |= 8;
		if (!useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment)) bitflag |= 2048;
		var extFileAttr = 0;
		var versionMadeBy = 0;
		if (dir) extFileAttr |= 16;
		if (platform === "UNIX") {
			versionMadeBy = 798;
			extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
		} else {
			versionMadeBy = 20;
			extFileAttr |= generateDosExternalFileAttr(file.dosPermissions, dir);
		}
		dosTime = date.getUTCHours();
		dosTime = dosTime << 6;
		dosTime = dosTime | date.getUTCMinutes();
		dosTime = dosTime << 5;
		dosTime = dosTime | date.getUTCSeconds() / 2;
		dosDate = date.getUTCFullYear() - 1980;
		dosDate = dosDate << 4;
		dosDate = dosDate | date.getUTCMonth() + 1;
		dosDate = dosDate << 5;
		dosDate = dosDate | date.getUTCDate();
		if (useUTF8ForFileName) {
			unicodePathExtraField = decToHex(1, 1) + decToHex(crc32(encodedFileName), 4) + utfEncodedFileName;
			extraFields += "up" + decToHex(unicodePathExtraField.length, 2) + unicodePathExtraField;
		}
		if (useUTF8ForComment) {
			unicodeCommentExtraField = decToHex(1, 1) + decToHex(crc32(encodedComment), 4) + utfEncodedComment;
			extraFields += "uc" + decToHex(unicodeCommentExtraField.length, 2) + unicodeCommentExtraField;
		}
		var header = "";
		header += "\n\0";
		header += decToHex(bitflag, 2);
		header += compression.magic;
		header += decToHex(dosTime, 2);
		header += decToHex(dosDate, 2);
		header += decToHex(dataInfo.crc32, 4);
		header += decToHex(dataInfo.compressedSize, 4);
		header += decToHex(dataInfo.uncompressedSize, 4);
		header += decToHex(encodedFileName.length, 2);
		header += decToHex(extraFields.length, 2);
		return {
			fileRecord: signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields,
			dirRecord: signature.CENTRAL_FILE_HEADER + decToHex(versionMadeBy, 2) + header + decToHex(encodedComment.length, 2) + "\0\0\0\0" + decToHex(extFileAttr, 4) + decToHex(offset, 4) + encodedFileName + extraFields + encodedComment
		};
	};
	/**
	* Generate the EOCD record.
	* @param {Number} entriesCount the number of entries in the zip file.
	* @param {Number} centralDirLength the length (in bytes) of the central dir.
	* @param {Number} localDirLength the length (in bytes) of the local dir.
	* @param {String} comment the zip file comment as a binary string.
	* @param {Function} encodeFileName the function to encode the comment.
	* @return {String} the EOCD record.
	*/
	var generateCentralDirectoryEnd = function(entriesCount, centralDirLength, localDirLength, comment, encodeFileName) {
		var dirEnd = "";
		var encodedComment = utils.transformTo("string", encodeFileName(comment));
		dirEnd = signature.CENTRAL_DIRECTORY_END + "\0\0\0\0" + decToHex(entriesCount, 2) + decToHex(entriesCount, 2) + decToHex(centralDirLength, 4) + decToHex(localDirLength, 4) + decToHex(encodedComment.length, 2) + encodedComment;
		return dirEnd;
	};
	/**
	* Generate data descriptors for a file entry.
	* @param {Object} streamInfo the hash generated by a worker, containing information
	* on the file entry.
	* @return {String} the data descriptors.
	*/
	var generateDataDescriptors = function(streamInfo) {
		var descriptor = "";
		descriptor = signature.DATA_DESCRIPTOR + decToHex(streamInfo["crc32"], 4) + decToHex(streamInfo["compressedSize"], 4) + decToHex(streamInfo["uncompressedSize"], 4);
		return descriptor;
	};
	/**
	* A worker to concatenate other workers to create a zip file.
	* @param {Boolean} streamFiles `true` to stream the content of the files,
	* `false` to accumulate it.
	* @param {String} comment the comment to use.
	* @param {String} platform the platform to use, "UNIX" or "DOS".
	* @param {Function} encodeFileName the function to encode file names and comments.
	*/
	function ZipFileWorker(streamFiles, comment, platform, encodeFileName) {
		GenericWorker.call(this, "ZipFileWorker");
		this.bytesWritten = 0;
		this.zipComment = comment;
		this.zipPlatform = platform;
		this.encodeFileName = encodeFileName;
		this.streamFiles = streamFiles;
		this.accumulate = false;
		this.contentBuffer = [];
		this.dirRecords = [];
		this.currentSourceOffset = 0;
		this.entriesCount = 0;
		this.currentFile = null;
		this._sources = [];
	}
	utils.inherits(ZipFileWorker, GenericWorker);
	/**
	* @see GenericWorker.push
	*/
	ZipFileWorker.prototype.push = function(chunk) {
		var currentFilePercent = chunk.meta.percent || 0;
		var entriesCount = this.entriesCount;
		var remainingFiles = this._sources.length;
		if (this.accumulate) this.contentBuffer.push(chunk);
		else {
			this.bytesWritten += chunk.data.length;
			GenericWorker.prototype.push.call(this, {
				data: chunk.data,
				meta: {
					currentFile: this.currentFile,
					percent: entriesCount ? (currentFilePercent + 100 * (entriesCount - remainingFiles - 1)) / entriesCount : 100
				}
			});
		}
	};
	/**
	* The worker started a new source (an other worker).
	* @param {Object} streamInfo the streamInfo object from the new source.
	*/
	ZipFileWorker.prototype.openedSource = function(streamInfo) {
		this.currentSourceOffset = this.bytesWritten;
		this.currentFile = streamInfo["file"].name;
		var streamedContent = this.streamFiles && !streamInfo["file"].dir;
		if (streamedContent) {
			var record = generateZipParts(streamInfo, streamedContent, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
			this.push({
				data: record.fileRecord,
				meta: { percent: 0 }
			});
		} else this.accumulate = true;
	};
	/**
	* The worker finished a source (an other worker).
	* @param {Object} streamInfo the streamInfo object from the finished source.
	*/
	ZipFileWorker.prototype.closedSource = function(streamInfo) {
		this.accumulate = false;
		var streamedContent = this.streamFiles && !streamInfo["file"].dir;
		var record = generateZipParts(streamInfo, streamedContent, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
		this.dirRecords.push(record.dirRecord);
		if (streamedContent) this.push({
			data: generateDataDescriptors(streamInfo),
			meta: { percent: 100 }
		});
		else {
			this.push({
				data: record.fileRecord,
				meta: { percent: 0 }
			});
			while (this.contentBuffer.length) this.push(this.contentBuffer.shift());
		}
		this.currentFile = null;
	};
	/**
	* @see GenericWorker.flush
	*/
	ZipFileWorker.prototype.flush = function() {
		var localDirLength = this.bytesWritten;
		for (var i = 0; i < this.dirRecords.length; i++) this.push({
			data: this.dirRecords[i],
			meta: { percent: 100 }
		});
		var centralDirLength = this.bytesWritten - localDirLength;
		var dirEnd = generateCentralDirectoryEnd(this.dirRecords.length, centralDirLength, localDirLength, this.zipComment, this.encodeFileName);
		this.push({
			data: dirEnd,
			meta: { percent: 100 }
		});
	};
	/**
	* Prepare the next source to be read.
	*/
	ZipFileWorker.prototype.prepareNextSource = function() {
		this.previous = this._sources.shift();
		this.openedSource(this.previous.streamInfo);
		if (this.isPaused) this.previous.pause();
		else this.previous.resume();
	};
	/**
	* @see GenericWorker.registerPrevious
	*/
	ZipFileWorker.prototype.registerPrevious = function(previous) {
		this._sources.push(previous);
		var self = this;
		previous.on("data", function(chunk) {
			self.processChunk(chunk);
		});
		previous.on("end", function() {
			self.closedSource(self.previous.streamInfo);
			if (self._sources.length) self.prepareNextSource();
			else self.end();
		});
		previous.on("error", function(e) {
			self.error(e);
		});
		return this;
	};
	/**
	* @see GenericWorker.resume
	*/
	ZipFileWorker.prototype.resume = function() {
		if (!GenericWorker.prototype.resume.call(this)) return false;
		if (!this.previous && this._sources.length) {
			this.prepareNextSource();
			return true;
		}
		if (!this.previous && !this._sources.length && !this.generatedError) {
			this.end();
			return true;
		}
	};
	/**
	* @see GenericWorker.error
	*/
	ZipFileWorker.prototype.error = function(e) {
		var sources = this._sources;
		if (!GenericWorker.prototype.error.call(this, e)) return false;
		for (var i = 0; i < sources.length; i++) try {
			sources[i].error(e);
		} catch (e) {}
		return true;
	};
	/**
	* @see GenericWorker.lock
	*/
	ZipFileWorker.prototype.lock = function() {
		GenericWorker.prototype.lock.call(this);
		var sources = this._sources;
		for (var i = 0; i < sources.length; i++) sources[i].lock();
	};
	module.exports = ZipFileWorker;
}));
// node_modules/jszip/lib/generate/index.js
var require_generate = /* @__PURE__ */ __commonJSMin(((exports) => {
	var compressions = require_compressions();
	var ZipFileWorker = require_ZipFileWorker();
	/**
	* Find the compression to use.
	* @param {String} fileCompression the compression defined at the file level, if any.
	* @param {String} zipCompression the compression defined at the load() level.
	* @return {Object} the compression object to use.
	*/
	var getCompression = function(fileCompression, zipCompression) {
		var compressionName = fileCompression || zipCompression;
		var compression = compressions[compressionName];
		if (!compression) throw new Error(compressionName + " is not a valid compression method !");
		return compression;
	};
	/**
	* Create a worker to generate a zip file.
	* @param {JSZip} zip the JSZip instance at the right root level.
	* @param {Object} options to generate the zip file.
	* @param {String} comment the comment to use.
	*/
	exports.generateWorker = function(zip, options, comment) {
		var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
		var entriesCount = 0;
		try {
			zip.forEach(function(relativePath, file) {
				entriesCount++;
				var compression = getCompression(file.options.compression, options.compression);
				var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
				var dir = file.dir, date = file.date;
				file._compressWorker(compression, compressionOptions).withStreamInfo("file", {
					name: relativePath,
					dir,
					date,
					comment: file.comment || "",
					unixPermissions: file.unixPermissions,
					dosPermissions: file.dosPermissions
				}).pipe(zipFileWorker);
			});
			zipFileWorker.entriesCount = entriesCount;
		} catch (e) {
			zipFileWorker.error(e);
		}
		return zipFileWorker;
	};
}));
// node_modules/jszip/lib/nodejs/NodejsStreamInputAdapter.js
var require_NodejsStreamInputAdapter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	/**
	* A worker that use a nodejs stream as source.
	* @constructor
	* @param {String} filename the name of the file entry for this stream.
	* @param {Readable} stream the nodejs stream.
	*/
	function NodejsStreamInputAdapter(filename, stream) {
		GenericWorker.call(this, "Nodejs stream input adapter for " + filename);
		this._upstreamEnded = false;
		this._bindStream(stream);
	}
	utils.inherits(NodejsStreamInputAdapter, GenericWorker);
	/**
	* Prepare the stream and bind the callbacks on it.
	* Do this ASAP on node 0.10 ! A lazy binding doesn't always work.
	* @param {Stream} stream the nodejs stream to use.
	*/
	NodejsStreamInputAdapter.prototype._bindStream = function(stream) {
		var self = this;
		this._stream = stream;
		stream.pause();
		stream.on("data", function(chunk) {
			self.push({
				data: chunk,
				meta: { percent: 0 }
			});
		}).on("error", function(e) {
			if (self.isPaused) this.generatedError = e;
			else self.error(e);
		}).on("end", function() {
			if (self.isPaused) self._upstreamEnded = true;
			else self.end();
		});
	};
	NodejsStreamInputAdapter.prototype.pause = function() {
		if (!GenericWorker.prototype.pause.call(this)) return false;
		this._stream.pause();
		return true;
	};
	NodejsStreamInputAdapter.prototype.resume = function() {
		if (!GenericWorker.prototype.resume.call(this)) return false;
		if (this._upstreamEnded) this.end();
		else this._stream.resume();
		return true;
	};
	module.exports = NodejsStreamInputAdapter;
}));
// node_modules/jszip/lib/object.js
var require_object = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utf8 = require_utf8();
	var utils = require_utils();
	var GenericWorker = require_GenericWorker();
	var StreamHelper = require_StreamHelper();
	var defaults = require_defaults();
	var CompressedObject = require_compressedObject();
	var ZipObject = require_zipObject();
	var generate = require_generate();
	var nodejsUtils = require_nodejsUtils();
	var NodejsStreamInputAdapter = require_NodejsStreamInputAdapter();
	/**
	* Add a file in the current folder.
	* @private
	* @param {string} name the name of the file
	* @param {String|ArrayBuffer|Uint8Array|Buffer} data the data of the file
	* @param {Object} originalOptions the options of the file
	* @return {Object} the new file.
	*/
	var fileAdd = function(name, data, originalOptions) {
		var dataType = utils.getTypeOf(data), parent;
		var o = utils.extend(originalOptions || {}, defaults);
		o.date = o.date || /* @__PURE__ */ new Date();
		if (o.compression !== null) o.compression = o.compression.toUpperCase();
		if (typeof o.unixPermissions === "string") o.unixPermissions = parseInt(o.unixPermissions, 8);
		if (o.unixPermissions && o.unixPermissions & 16384) o.dir = true;
		if (o.dosPermissions && o.dosPermissions & 16) o.dir = true;
		if (o.dir) name = forceTrailingSlash(name);
		if (o.createFolders && (parent = parentFolder(name))) folderAdd.call(this, parent, true);
		var isUnicodeString = dataType === "string" && o.binary === false && o.base64 === false;
		if (!originalOptions || typeof originalOptions.binary === "undefined") o.binary = !isUnicodeString;
		if (data instanceof CompressedObject && data.uncompressedSize === 0 || o.dir || !data || data.length === 0) {
			o.base64 = false;
			o.binary = true;
			data = "";
			o.compression = "STORE";
			dataType = "string";
		}
		var zipObjectContent = null;
		if (data instanceof CompressedObject || data instanceof GenericWorker) zipObjectContent = data;
		else if (nodejsUtils.isNode && nodejsUtils.isStream(data)) zipObjectContent = new NodejsStreamInputAdapter(name, data);
		else zipObjectContent = utils.prepareContent(name, data, o.binary, o.optimizedBinaryString, o.base64);
		var object = new ZipObject(name, zipObjectContent, o);
		this.files[name] = object;
	};
	/**
	* Find the parent folder of the path.
	* @private
	* @param {string} path the path to use
	* @return {string} the parent folder, or ""
	*/
	var parentFolder = function(path) {
		if (path.slice(-1) === "/") path = path.substring(0, path.length - 1);
		var lastSlash = path.lastIndexOf("/");
		return lastSlash > 0 ? path.substring(0, lastSlash) : "";
	};
	/**
	* Returns the path with a slash at the end.
	* @private
	* @param {String} path the path to check.
	* @return {String} the path with a trailing slash.
	*/
	var forceTrailingSlash = function(path) {
		if (path.slice(-1) !== "/") path += "/";
		return path;
	};
	/**
	* Add a (sub) folder in the current folder.
	* @private
	* @param {string} name the folder's name
	* @param {boolean=} [createFolders] If true, automatically create sub
	*  folders. Defaults to false.
	* @return {Object} the new folder.
	*/
	var folderAdd = function(name, createFolders) {
		createFolders = typeof createFolders !== "undefined" ? createFolders : defaults.createFolders;
		name = forceTrailingSlash(name);
		if (!this.files[name]) fileAdd.call(this, name, null, {
			dir: true,
			createFolders
		});
		return this.files[name];
	};
	/**
	* Cross-window, cross-Node-context regular expression detection
	* @param  {Object}  object Anything
	* @return {Boolean}        true if the object is a regular expression,
	* false otherwise
	*/
	function isRegExp(object) {
		return Object.prototype.toString.call(object) === "[object RegExp]";
	}
	module.exports = {
		/**
		* @see loadAsync
		*/
		load: function() {
			throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
		},
		/**
		* Call a callback function for each entry at this folder level.
		* @param {Function} cb the callback function:
		* function (relativePath, file) {...}
		* It takes 2 arguments : the relative path and the file.
		*/
		forEach: function(cb) {
			var filename, relativePath, file;
			for (filename in this.files) {
				file = this.files[filename];
				relativePath = filename.slice(this.root.length, filename.length);
				if (relativePath && filename.slice(0, this.root.length) === this.root) cb(relativePath, file);
			}
		},
		/**
		* Filter nested files/folders with the specified function.
		* @param {Function} search the predicate to use :
		* function (relativePath, file) {...}
		* It takes 2 arguments : the relative path and the file.
		* @return {Array} An array of matching elements.
		*/
		filter: function(search) {
			var result = [];
			this.forEach(function(relativePath, entry) {
				if (search(relativePath, entry)) result.push(entry);
			});
			return result;
		},
		/**
		* Add a file to the zip file, or search a file.
		* @param   {string|RegExp} name The name of the file to add (if data is defined),
		* the name of the file to find (if no data) or a regex to match files.
		* @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded
		* @param   {Object} o     File options
		* @return  {JSZip|Object|Array} this JSZip object (when adding a file),
		* a file (when searching by string) or an array of files (when searching by regex).
		*/
		file: function(name, data, o) {
			if (arguments.length === 1) {
				if (isRegExp(name)) {
					var regexp = name;
					return this.filter(function(relativePath, file) {
						return !file.dir && regexp.test(relativePath);
					});
				} else {
					var obj = this.files[this.root + name];
					if (obj && !obj.dir) return obj;
					else return null;
				}
			} else {
				name = this.root + name;
				fileAdd.call(this, name, data, o);
			}
			return this;
		},
		/**
		* Add a directory to the zip file, or search.
		* @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
		* @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
		*/
		folder: function(arg) {
			if (!arg) return this;
			if (isRegExp(arg)) return this.filter(function(relativePath, file) {
				return file.dir && arg.test(relativePath);
			});
			var name = this.root + arg;
			var newFolder = folderAdd.call(this, name);
			var ret = this.clone();
			ret.root = newFolder.name;
			return ret;
		},
		/**
		* Delete a file, or a directory and all sub-files, from the zip
		* @param {string} name the name of the file to delete
		* @return {JSZip} this JSZip object
		*/
		remove: function(name) {
			name = this.root + name;
			var file = this.files[name];
			if (!file) {
				if (name.slice(-1) !== "/") name += "/";
				file = this.files[name];
			}
			if (file && !file.dir) delete this.files[name];
			else {
				var kids = this.filter(function(relativePath, file) {
					return file.name.slice(0, name.length) === name;
				});
				for (var i = 0; i < kids.length; i++) delete this.files[kids[i].name];
			}
			return this;
		},
		/**
		* @deprecated This method has been removed in JSZip 3.0, please check the upgrade guide.
		*/
		generate: function() {
			throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
		},
		/**
		* Generate the complete zip file as an internal stream.
		* @param {Object} options the options to generate the zip file :
		* - compression, "STORE" by default.
		* - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
		* @return {StreamHelper} the streamed zip file.
		*/
		generateInternalStream: function(options) {
			var worker, opts = {};
			try {
				opts = utils.extend(options || {}, {
					streamFiles: false,
					compression: "STORE",
					compressionOptions: null,
					type: "",
					platform: "DOS",
					comment: null,
					mimeType: "application/zip",
					encodeFileName: utf8.utf8encode
				});
				opts.type = opts.type.toLowerCase();
				opts.compression = opts.compression.toUpperCase();
				if (opts.type === "binarystring") opts.type = "string";
				if (!opts.type) throw new Error("No output type specified.");
				utils.checkSupport(opts.type);
				if (opts.platform === "darwin" || opts.platform === "freebsd" || opts.platform === "linux" || opts.platform === "sunos") opts.platform = "UNIX";
				if (opts.platform === "win32") opts.platform = "DOS";
				var comment = opts.comment || this.comment || "";
				worker = generate.generateWorker(this, opts, comment);
			} catch (e) {
				worker = new GenericWorker("error");
				worker.error(e);
			}
			return new StreamHelper(worker, opts.type || "string", opts.mimeType);
		},
		/**
		* Generate the complete zip file asynchronously.
		* @see generateInternalStream
		*/
		generateAsync: function(options, onUpdate) {
			return this.generateInternalStream(options).accumulate(onUpdate);
		},
		/**
		* Generate the complete zip file asynchronously.
		* @see generateInternalStream
		*/
		generateNodeStream: function(options, onUpdate) {
			options = options || {};
			if (!options.type) options.type = "nodebuffer";
			return this.generateInternalStream(options).toNodejsStream(onUpdate);
		}
	};
}));
// node_modules/jszip/lib/reader/DataReader.js
var require_DataReader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	function DataReader(data) {
		this.data = data;
		this.length = data.length;
		this.index = 0;
		this.zero = 0;
	}
	DataReader.prototype = {
		/**
		* Check that the offset will not go too far.
		* @param {string} offset the additional offset to check.
		* @throws {Error} an Error if the offset is out of bounds.
		*/
		checkOffset: function(offset) {
			this.checkIndex(this.index + offset);
		},
		/**
		* Check that the specified index will not be too far.
		* @param {string} newIndex the index to check.
		* @throws {Error} an Error if the index is out of bounds.
		*/
		checkIndex: function(newIndex) {
			if (this.length < this.zero + newIndex || newIndex < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + newIndex + "). Corrupted zip ?");
		},
		/**
		* Change the index.
		* @param {number} newIndex The new index.
		* @throws {Error} if the new index is out of the data.
		*/
		setIndex: function(newIndex) {
			this.checkIndex(newIndex);
			this.index = newIndex;
		},
		/**
		* Skip the next n bytes.
		* @param {number} n the number of bytes to skip.
		* @throws {Error} if the new index is out of the data.
		*/
		skip: function(n) {
			this.setIndex(this.index + n);
		},
		/**
		* Get the byte at the specified index.
		* @param {number} i the index to use.
		* @return {number} a byte.
		*/
		byteAt: function() {},
		/**
		* Get the next number with a given byte size.
		* @param {number} size the number of bytes to read.
		* @return {number} the corresponding number.
		*/
		readInt: function(size) {
			var result = 0, i;
			this.checkOffset(size);
			for (i = this.index + size - 1; i >= this.index; i--) result = (result << 8) + this.byteAt(i);
			this.index += size;
			return result;
		},
		/**
		* Get the next string with a given byte size.
		* @param {number} size the number of bytes to read.
		* @return {string} the corresponding string.
		*/
		readString: function(size) {
			return utils.transformTo("string", this.readData(size));
		},
		/**
		* Get raw data without conversion, <size> bytes.
		* @param {number} size the number of bytes to read.
		* @return {Object} the raw data, implementation specific.
		*/
		readData: function() {},
		/**
		* Find the last occurrence of a zip signature (4 bytes).
		* @param {string} sig the signature to find.
		* @return {number} the index of the last occurrence, -1 if not found.
		*/
		lastIndexOfSignature: function() {},
		/**
		* Read the signature (4 bytes) at the current position and compare it with sig.
		* @param {string} sig the expected signature
		* @return {boolean} true if the signature matches, false otherwise.
		*/
		readAndCheckSignature: function() {},
		/**
		* Get the next date.
		* @return {Date} the date.
		*/
		readDate: function() {
			var dostime = this.readInt(4);
			return new Date(Date.UTC((dostime >> 25 & 127) + 1980, (dostime >> 21 & 15) - 1, dostime >> 16 & 31, dostime >> 11 & 31, dostime >> 5 & 63, (dostime & 31) << 1));
		}
	};
	module.exports = DataReader;
}));
// node_modules/jszip/lib/reader/ArrayReader.js
var require_ArrayReader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var DataReader = require_DataReader();
	var utils = require_utils();
	function ArrayReader(data) {
		DataReader.call(this, data);
		for (var i = 0; i < this.data.length; i++) data[i] = data[i] & 255;
	}
	utils.inherits(ArrayReader, DataReader);
	/**
	* @see DataReader.byteAt
	*/
	ArrayReader.prototype.byteAt = function(i) {
		return this.data[this.zero + i];
	};
	/**
	* @see DataReader.lastIndexOfSignature
	*/
	ArrayReader.prototype.lastIndexOfSignature = function(sig) {
		var sig0 = sig.charCodeAt(0), sig1 = sig.charCodeAt(1), sig2 = sig.charCodeAt(2), sig3 = sig.charCodeAt(3);
		for (var i = this.length - 4; i >= 0; --i) if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) return i - this.zero;
		return -1;
	};
	/**
	* @see DataReader.readAndCheckSignature
	*/
	ArrayReader.prototype.readAndCheckSignature = function(sig) {
		var sig0 = sig.charCodeAt(0), sig1 = sig.charCodeAt(1), sig2 = sig.charCodeAt(2), sig3 = sig.charCodeAt(3), data = this.readData(4);
		return sig0 === data[0] && sig1 === data[1] && sig2 === data[2] && sig3 === data[3];
	};
	/**
	* @see DataReader.readData
	*/
	ArrayReader.prototype.readData = function(size) {
		this.checkOffset(size);
		if (size === 0) return [];
		var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
		this.index += size;
		return result;
	};
	module.exports = ArrayReader;
}));
// node_modules/jszip/lib/reader/StringReader.js
var require_StringReader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var DataReader = require_DataReader();
	var utils = require_utils();
	function StringReader(data) {
		DataReader.call(this, data);
	}
	utils.inherits(StringReader, DataReader);
	/**
	* @see DataReader.byteAt
	*/
	StringReader.prototype.byteAt = function(i) {
		return this.data.charCodeAt(this.zero + i);
	};
	/**
	* @see DataReader.lastIndexOfSignature
	*/
	StringReader.prototype.lastIndexOfSignature = function(sig) {
		return this.data.lastIndexOf(sig) - this.zero;
	};
	/**
	* @see DataReader.readAndCheckSignature
	*/
	StringReader.prototype.readAndCheckSignature = function(sig) {
		return sig === this.readData(4);
	};
	/**
	* @see DataReader.readData
	*/
	StringReader.prototype.readData = function(size) {
		this.checkOffset(size);
		var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
		this.index += size;
		return result;
	};
	module.exports = StringReader;
}));
// node_modules/jszip/lib/reader/Uint8ArrayReader.js
var require_Uint8ArrayReader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ArrayReader = require_ArrayReader();
	var utils = require_utils();
	function Uint8ArrayReader(data) {
		ArrayReader.call(this, data);
	}
	utils.inherits(Uint8ArrayReader, ArrayReader);
	/**
	* @see DataReader.readData
	*/
	Uint8ArrayReader.prototype.readData = function(size) {
		this.checkOffset(size);
		if (size === 0) return /* @__PURE__ */ new Uint8Array(0);
		var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
		this.index += size;
		return result;
	};
	module.exports = Uint8ArrayReader;
}));
// node_modules/jszip/lib/reader/NodeBufferReader.js
var require_NodeBufferReader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Uint8ArrayReader = require_Uint8ArrayReader();
	var utils = require_utils();
	function NodeBufferReader(data) {
		Uint8ArrayReader.call(this, data);
	}
	utils.inherits(NodeBufferReader, Uint8ArrayReader);
	/**
	* @see DataReader.readData
	*/
	NodeBufferReader.prototype.readData = function(size) {
		this.checkOffset(size);
		var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
		this.index += size;
		return result;
	};
	module.exports = NodeBufferReader;
}));
// node_modules/jszip/lib/reader/readerFor.js
var require_readerFor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var support = require_support();
	var ArrayReader = require_ArrayReader();
	var StringReader = require_StringReader();
	var NodeBufferReader = require_NodeBufferReader();
	var Uint8ArrayReader = require_Uint8ArrayReader();
	/**
	* Create a reader adapted to the data.
	* @param {String|ArrayBuffer|Uint8Array|Buffer} data the data to read.
	* @return {DataReader} the data reader.
	*/
	module.exports = function(data) {
		var type = utils.getTypeOf(data);
		utils.checkSupport(type);
		if (type === "string" && !support.uint8array) return new StringReader(data);
		if (type === "nodebuffer") return new NodeBufferReader(data);
		if (support.uint8array) return new Uint8ArrayReader(utils.transformTo("uint8array", data));
		return new ArrayReader(utils.transformTo("array", data));
	};
}));
// node_modules/jszip/lib/zipEntry.js
var require_zipEntry = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var readerFor = require_readerFor();
	var utils = require_utils();
	var CompressedObject = require_compressedObject();
	var crc32fn = require_crc32$1();
	var utf8 = require_utf8();
	var compressions = require_compressions();
	var support = require_support();
	var MADE_BY_DOS = 0;
	var MADE_BY_UNIX = 3;
	/**
	* Find a compression registered in JSZip.
	* @param {string} compressionMethod the method magic to find.
	* @return {Object|null} the JSZip compression object, null if none found.
	*/
	var findCompression = function(compressionMethod) {
		for (var method in compressions) {
			if (!Object.prototype.hasOwnProperty.call(compressions, method)) continue;
			if (compressions[method].magic === compressionMethod) return compressions[method];
		}
		return null;
	};
	/**
	* An entry in the zip file.
	* @constructor
	* @param {Object} options Options of the current file.
	* @param {Object} loadOptions Options for loading the stream.
	*/
	function ZipEntry(options, loadOptions) {
		this.options = options;
		this.loadOptions = loadOptions;
	}
	ZipEntry.prototype = {
		/**
		* say if the file is encrypted.
		* @return {boolean} true if the file is encrypted, false otherwise.
		*/
		isEncrypted: function() {
			return (this.bitFlag & 1) === 1;
		},
		/**
		* say if the file has utf-8 filename/comment.
		* @return {boolean} true if the filename/comment is in utf-8, false otherwise.
		*/
		useUTF8: function() {
			return (this.bitFlag & 2048) === 2048;
		},
		/**
		* Read the local part of a zip file and add the info in this object.
		* @param {DataReader} reader the reader to use.
		*/
		readLocalPart: function(reader) {
			var compression, localExtraFieldsLength;
			reader.skip(22);
			this.fileNameLength = reader.readInt(2);
			localExtraFieldsLength = reader.readInt(2);
			this.fileName = reader.readData(this.fileNameLength);
			reader.skip(localExtraFieldsLength);
			if (this.compressedSize === -1 || this.uncompressedSize === -1) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
			compression = findCompression(this.compressionMethod);
			if (compression === null) throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + utils.transformTo("string", this.fileName) + ")");
			this.decompressed = new CompressedObject(this.compressedSize, this.uncompressedSize, this.crc32, compression, reader.readData(this.compressedSize));
		},
		/**
		* Read the central part of a zip file and add the info in this object.
		* @param {DataReader} reader the reader to use.
		*/
		readCentralPart: function(reader) {
			this.versionMadeBy = reader.readInt(2);
			reader.skip(2);
			this.bitFlag = reader.readInt(2);
			this.compressionMethod = reader.readString(2);
			this.date = reader.readDate();
			this.crc32 = reader.readInt(4);
			this.compressedSize = reader.readInt(4);
			this.uncompressedSize = reader.readInt(4);
			var fileNameLength = reader.readInt(2);
			this.extraFieldsLength = reader.readInt(2);
			this.fileCommentLength = reader.readInt(2);
			this.diskNumberStart = reader.readInt(2);
			this.internalFileAttributes = reader.readInt(2);
			this.externalFileAttributes = reader.readInt(4);
			this.localHeaderOffset = reader.readInt(4);
			if (this.isEncrypted()) throw new Error("Encrypted zip are not supported");
			reader.skip(fileNameLength);
			this.readExtraFields(reader);
			this.parseZIP64ExtraField(reader);
			this.fileComment = reader.readData(this.fileCommentLength);
		},
		/**
		* Parse the external file attributes and get the unix/dos permissions.
		*/
		processAttributes: function() {
			this.unixPermissions = null;
			this.dosPermissions = null;
			var madeBy = this.versionMadeBy >> 8;
			this.dir = this.externalFileAttributes & 16 ? true : false;
			if (madeBy === MADE_BY_DOS) this.dosPermissions = this.externalFileAttributes & 63;
			if (madeBy === MADE_BY_UNIX) this.unixPermissions = this.externalFileAttributes >> 16 & 65535;
			if (!this.dir && this.fileNameStr.slice(-1) === "/") this.dir = true;
		},
		/**
		* Parse the ZIP64 extra field and merge the info in the current ZipEntry.
		* @param {DataReader} reader the reader to use.
		*/
		parseZIP64ExtraField: function() {
			if (!this.extraFields[1]) return;
			var extraReader = readerFor(this.extraFields[1].value);
			if (this.uncompressedSize === utils.MAX_VALUE_32BITS) this.uncompressedSize = extraReader.readInt(8);
			if (this.compressedSize === utils.MAX_VALUE_32BITS) this.compressedSize = extraReader.readInt(8);
			if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) this.localHeaderOffset = extraReader.readInt(8);
			if (this.diskNumberStart === utils.MAX_VALUE_32BITS) this.diskNumberStart = extraReader.readInt(4);
		},
		/**
		* Read the central part of a zip file and add the info in this object.
		* @param {DataReader} reader the reader to use.
		*/
		readExtraFields: function(reader) {
			var end = reader.index + this.extraFieldsLength, extraFieldId, extraFieldLength, extraFieldValue;
			if (!this.extraFields) this.extraFields = {};
			while (reader.index + 4 < end) {
				extraFieldId = reader.readInt(2);
				extraFieldLength = reader.readInt(2);
				extraFieldValue = reader.readData(extraFieldLength);
				this.extraFields[extraFieldId] = {
					id: extraFieldId,
					length: extraFieldLength,
					value: extraFieldValue
				};
			}
			reader.setIndex(end);
		},
		/**
		* Apply an UTF8 transformation if needed.
		*/
		handleUTF8: function() {
			var decodeParamType = support.uint8array ? "uint8array" : "array";
			if (this.useUTF8()) {
				this.fileNameStr = utf8.utf8decode(this.fileName);
				this.fileCommentStr = utf8.utf8decode(this.fileComment);
			} else {
				var upath = this.findExtraFieldUnicodePath();
				if (upath !== null) this.fileNameStr = upath;
				else {
					var fileNameByteArray = utils.transformTo(decodeParamType, this.fileName);
					this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
				}
				var ucomment = this.findExtraFieldUnicodeComment();
				if (ucomment !== null) this.fileCommentStr = ucomment;
				else {
					var commentByteArray = utils.transformTo(decodeParamType, this.fileComment);
					this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
				}
			}
		},
		/**
		* Find the unicode path declared in the extra field, if any.
		* @return {String} the unicode path, null otherwise.
		*/
		findExtraFieldUnicodePath: function() {
			var upathField = this.extraFields[28789];
			if (upathField) {
				var extraReader = readerFor(upathField.value);
				if (extraReader.readInt(1) !== 1) return null;
				if (crc32fn(this.fileName) !== extraReader.readInt(4)) return null;
				return utf8.utf8decode(extraReader.readData(upathField.length - 5));
			}
			return null;
		},
		/**
		* Find the unicode comment declared in the extra field, if any.
		* @return {String} the unicode comment, null otherwise.
		*/
		findExtraFieldUnicodeComment: function() {
			var ucommentField = this.extraFields[25461];
			if (ucommentField) {
				var extraReader = readerFor(ucommentField.value);
				if (extraReader.readInt(1) !== 1) return null;
				if (crc32fn(this.fileComment) !== extraReader.readInt(4)) return null;
				return utf8.utf8decode(extraReader.readData(ucommentField.length - 5));
			}
			return null;
		}
	};
	module.exports = ZipEntry;
}));
// node_modules/jszip/lib/zipEntries.js
var require_zipEntries = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var readerFor = require_readerFor();
	var utils = require_utils();
	var sig = require_signature();
	var ZipEntry = require_zipEntry();
	var support = require_support();
	/**
	* All the entries in the zip file.
	* @constructor
	* @param {Object} loadOptions Options for loading the stream.
	*/
	function ZipEntries(loadOptions) {
		this.files = [];
		this.loadOptions = loadOptions;
	}
	ZipEntries.prototype = {
		/**
		* Check that the reader is on the specified signature.
		* @param {string} expectedSignature the expected signature.
		* @throws {Error} if it is an other signature.
		*/
		checkSignature: function(expectedSignature) {
			if (!this.reader.readAndCheckSignature(expectedSignature)) {
				this.reader.index -= 4;
				var signature = this.reader.readString(4);
				throw new Error("Corrupted zip or bug: unexpected signature (" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
			}
		},
		/**
		* Check if the given signature is at the given index.
		* @param {number} askedIndex the index to check.
		* @param {string} expectedSignature the signature to expect.
		* @return {boolean} true if the signature is here, false otherwise.
		*/
		isSignature: function(askedIndex, expectedSignature) {
			var currentIndex = this.reader.index;
			this.reader.setIndex(askedIndex);
			var result = this.reader.readString(4) === expectedSignature;
			this.reader.setIndex(currentIndex);
			return result;
		},
		/**
		* Read the end of the central directory.
		*/
		readBlockEndOfCentral: function() {
			this.diskNumber = this.reader.readInt(2);
			this.diskWithCentralDirStart = this.reader.readInt(2);
			this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
			this.centralDirRecords = this.reader.readInt(2);
			this.centralDirSize = this.reader.readInt(4);
			this.centralDirOffset = this.reader.readInt(4);
			this.zipCommentLength = this.reader.readInt(2);
			var zipComment = this.reader.readData(this.zipCommentLength);
			var decodeParamType = support.uint8array ? "uint8array" : "array";
			var decodeContent = utils.transformTo(decodeParamType, zipComment);
			this.zipComment = this.loadOptions.decodeFileName(decodeContent);
		},
		/**
		* Read the end of the Zip 64 central directory.
		* Not merged with the method readEndOfCentral :
		* The end of central can coexist with its Zip64 brother,
		* I don't want to read the wrong number of bytes !
		*/
		readBlockZip64EndOfCentral: function() {
			this.zip64EndOfCentralSize = this.reader.readInt(8);
			this.reader.skip(4);
			this.diskNumber = this.reader.readInt(4);
			this.diskWithCentralDirStart = this.reader.readInt(4);
			this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
			this.centralDirRecords = this.reader.readInt(8);
			this.centralDirSize = this.reader.readInt(8);
			this.centralDirOffset = this.reader.readInt(8);
			this.zip64ExtensibleData = {};
			var extraDataSize = this.zip64EndOfCentralSize - 44, index = 0, extraFieldId, extraFieldLength, extraFieldValue;
			while (index < extraDataSize) {
				extraFieldId = this.reader.readInt(2);
				extraFieldLength = this.reader.readInt(4);
				extraFieldValue = this.reader.readData(extraFieldLength);
				this.zip64ExtensibleData[extraFieldId] = {
					id: extraFieldId,
					length: extraFieldLength,
					value: extraFieldValue
				};
			}
		},
		/**
		* Read the end of the Zip 64 central directory locator.
		*/
		readBlockZip64EndOfCentralLocator: function() {
			this.diskWithZip64CentralDirStart = this.reader.readInt(4);
			this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
			this.disksCount = this.reader.readInt(4);
			if (this.disksCount > 1) throw new Error("Multi-volumes zip are not supported");
		},
		/**
		* Read the local files, based on the offset read in the central part.
		*/
		readLocalFiles: function() {
			var i = 0, file;
			for (; i < this.files.length; i++) {
				file = this.files[i];
				this.reader.setIndex(file.localHeaderOffset);
				this.checkSignature(sig.LOCAL_FILE_HEADER);
				file.readLocalPart(this.reader);
				file.handleUTF8();
				file.processAttributes();
			}
		},
		/**
		* Read the central directory.
		*/
		readCentralDir: function() {
			var file;
			this.reader.setIndex(this.centralDirOffset);
			while (this.reader.readAndCheckSignature(sig.CENTRAL_FILE_HEADER)) {
				file = new ZipEntry({ zip64: this.zip64 }, this.loadOptions);
				file.readCentralPart(this.reader);
				this.files.push(file);
			}
			if (this.centralDirRecords !== this.files.length) {
				if (this.centralDirRecords !== 0 && this.files.length === 0) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
			}
		},
		/**
		* Read the end of central directory.
		*/
		readEndOfCentral: function() {
			var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
			if (offset < 0) {
				if (!this.isSignature(0, sig.LOCAL_FILE_HEADER)) throw new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
				else throw new Error("Corrupted zip: can't find end of central directory");
			}
			this.reader.setIndex(offset);
			var endOfCentralDirOffset = offset;
			this.checkSignature(sig.CENTRAL_DIRECTORY_END);
			this.readBlockEndOfCentral();
			if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
				this.zip64 = true;
				offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
				if (offset < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
				this.reader.setIndex(offset);
				this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
				this.readBlockZip64EndOfCentralLocator();
				if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
					this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
					if (this.relativeOffsetEndOfZip64CentralDir < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
				}
				this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
				this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
				this.readBlockZip64EndOfCentral();
			}
			var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
			if (this.zip64) {
				expectedEndOfCentralDirOffset += 20;
				expectedEndOfCentralDirOffset += 12 + this.zip64EndOfCentralSize;
			}
			var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;
			if (extraBytes > 0) {
				if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) {} else this.reader.zero = extraBytes;
			} else if (extraBytes < 0) throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
		},
		prepareReader: function(data) {
			this.reader = readerFor(data);
		},
		/**
		* Read a zip file and create ZipEntries.
		* @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
		*/
		load: function(data) {
			this.prepareReader(data);
			this.readEndOfCentral();
			this.readCentralDir();
			this.readLocalFiles();
		}
	};
	module.exports = ZipEntries;
}));
// node_modules/jszip/lib/load.js
var require_load = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var utils = require_utils();
	var external = require_external();
	var utf8 = require_utf8();
	var ZipEntries = require_zipEntries();
	var Crc32Probe = require_Crc32Probe();
	var nodejsUtils = require_nodejsUtils();
	/**
	* Check the CRC32 of an entry.
	* @param {ZipEntry} zipEntry the zip entry to check.
	* @return {Promise} the result.
	*/
	function checkEntryCRC32(zipEntry) {
		return new external.Promise(function(resolve, reject) {
			var worker = zipEntry.decompressed.getContentWorker().pipe(new Crc32Probe());
			worker.on("error", function(e) {
				reject(e);
			}).on("end", function() {
				if (worker.streamInfo.crc32 !== zipEntry.decompressed.crc32) reject(/* @__PURE__ */ new Error("Corrupted zip : CRC32 mismatch"));
				else resolve();
			}).resume();
		});
	}
	module.exports = function(data, options) {
		var zip = this;
		options = utils.extend(options || {}, {
			base64: false,
			checkCRC32: false,
			optimizedBinaryString: false,
			createFolders: false,
			decodeFileName: utf8.utf8decode
		});
		if (nodejsUtils.isNode && nodejsUtils.isStream(data)) return external.Promise.reject(/* @__PURE__ */ new Error("JSZip can't accept a stream when loading a zip file."));
		return utils.prepareContent("the loaded zip file", data, true, options.optimizedBinaryString, options.base64).then(function(data) {
			var zipEntries = new ZipEntries(options);
			zipEntries.load(data);
			return zipEntries;
		}).then(function checkCRC32(zipEntries) {
			var promises = [external.Promise.resolve(zipEntries)];
			var files = zipEntries.files;
			if (options.checkCRC32) for (var i = 0; i < files.length; i++) promises.push(checkEntryCRC32(files[i]));
			return external.Promise.all(promises);
		}).then(function addFiles(results) {
			var zipEntries = results.shift();
			var files = zipEntries.files;
			for (var i = 0; i < files.length; i++) {
				var input = files[i];
				var unsafeName = input.fileNameStr;
				var safeName = utils.resolve(input.fileNameStr);
				zip.file(safeName, input.decompressed, {
					binary: true,
					optimizedBinaryString: true,
					date: input.date,
					dir: input.dir,
					comment: input.fileCommentStr.length ? input.fileCommentStr : null,
					unixPermissions: input.unixPermissions,
					dosPermissions: input.dosPermissions,
					createFolders: options.createFolders
				});
				if (!input.dir) zip.file(safeName).unsafeOriginalName = unsafeName;
			}
			if (zipEntries.zipComment.length) zip.comment = zipEntries.zipComment;
			return zip;
		});
	};
}));
// node_modules/jszip/lib/index.js
var require_lib = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Representation a of zip file in js
	* @constructor
	*/
	function JSZip() {
		if (!(this instanceof JSZip)) return new JSZip();
		if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
		this.files = Object.create(null);
		this.comment = null;
		this.root = "";
		this.clone = function() {
			var newObj = new JSZip();
			for (var i in this) if (typeof this[i] !== "function") newObj[i] = this[i];
			return newObj;
		};
	}
	JSZip.prototype = require_object();
	JSZip.prototype.loadAsync = require_load();
	JSZip.support = require_support();
	JSZip.defaults = require_defaults();
	JSZip.version = "3.10.2";
	JSZip.loadAsync = function(content, options) {
		return new JSZip().loadAsync(content, options);
	};
	JSZip.external = require_external();
	module.exports = JSZip;
}));
// node_modules/yaml/dist/nodes/identity.js
var require_identity = /* @__PURE__ */ __commonJSMin(((exports) => {
	var ALIAS = Symbol.for("yaml.alias");
	var DOC = Symbol.for("yaml.document");
	var MAP = Symbol.for("yaml.map");
	var PAIR = Symbol.for("yaml.pair");
	var SCALAR = Symbol.for("yaml.scalar");
	var SEQ = Symbol.for("yaml.seq");
	var NODE_TYPE = Symbol.for("yaml.node.type");
	var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
	var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
	var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
	var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
	var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
	var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
	function isCollection(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case MAP:
			case SEQ: return true;
		}
		return false;
	}
	function isNode(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case ALIAS:
			case MAP:
			case SCALAR:
			case SEQ: return true;
		}
		return false;
	}
	var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
	exports.ALIAS = ALIAS;
	exports.DOC = DOC;
	exports.MAP = MAP;
	exports.NODE_TYPE = NODE_TYPE;
	exports.PAIR = PAIR;
	exports.SCALAR = SCALAR;
	exports.SEQ = SEQ;
	exports.hasAnchor = hasAnchor;
	exports.isAlias = isAlias;
	exports.isCollection = isCollection;
	exports.isDocument = isDocument;
	exports.isMap = isMap;
	exports.isNode = isNode;
	exports.isPair = isPair;
	exports.isScalar = isScalar;
	exports.isSeq = isSeq;
}));
// node_modules/yaml/dist/visit.js
var require_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var BREAK = Symbol("break visit");
	var SKIP = Symbol("skip children");
	var REMOVE = Symbol("remove node");
	/**
	* Apply a visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	function visit(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else visit_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visit.SKIP = SKIP;
	/** Remove the current node */
	visit.REMOVE = REMOVE;
	function visit_(key, node, visitor, path) {
		const ctrl = callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visit_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = visit_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = visit_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = visit_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	/**
	* Apply an async visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `Promise`: Must resolve to one of the following values
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	async function visitAsync(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else await visitAsync_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visitAsync.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visitAsync.SKIP = SKIP;
	/** Remove the current node */
	visitAsync.REMOVE = REMOVE;
	async function visitAsync_(key, node, visitor, path) {
		const ctrl = await callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visitAsync_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = await visitAsync_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = await visitAsync_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = await visitAsync_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	function initVisitor(visitor) {
		if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
			Alias: visitor.Node,
			Map: visitor.Node,
			Scalar: visitor.Node,
			Seq: visitor.Node
		}, visitor.Value && {
			Map: visitor.Value,
			Scalar: visitor.Value,
			Seq: visitor.Value
		}, visitor.Collection && {
			Map: visitor.Collection,
			Seq: visitor.Collection
		}, visitor);
		return visitor;
	}
	function callVisitor(key, node, visitor, path) {
		if (typeof visitor === "function") return visitor(key, node, path);
		if (identity.isMap(node)) return visitor.Map?.(key, node, path);
		if (identity.isSeq(node)) return visitor.Seq?.(key, node, path);
		if (identity.isPair(node)) return visitor.Pair?.(key, node, path);
		if (identity.isScalar(node)) return visitor.Scalar?.(key, node, path);
		if (identity.isAlias(node)) return visitor.Alias?.(key, node, path);
	}
	function replaceNode(key, path, node) {
		const parent = path[path.length - 1];
		if (identity.isCollection(parent)) parent.items[key] = node;
		else if (identity.isPair(parent)) {
			if (key === "key") parent.key = node;
			else parent.value = node;
		} else if (identity.isDocument(parent)) parent.contents = node;
		else {
			const pt = identity.isAlias(parent) ? "alias" : "scalar";
			throw new Error(`Cannot replace node with ${pt} parent`);
		}
	}
	exports.visit = visit;
	exports.visitAsync = visitAsync;
}));
// node_modules/yaml/dist/doc/directives.js
var require_directives = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	var escapeChars = {
		"!": "%21",
		",": "%2C",
		"[": "%5B",
		"]": "%5D",
		"{": "%7B",
		"}": "%7D"
	};
	var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
	var Directives = class Directives {
		constructor(yaml, tags) {
			/**
			* The directives-end/doc-start marker `---`. If `null`, a marker may still be
			* included in the document's stringified representation.
			*/
			this.docStart = null;
			/** The doc-end marker `...`.  */
			this.docEnd = false;
			this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
			this.tags = Object.assign({}, Directives.defaultTags, tags);
		}
		clone() {
			const copy = new Directives(this.yaml, this.tags);
			copy.docStart = this.docStart;
			return copy;
		}
		/**
		* During parsing, get a Directives instance for the current document and
		* update the stream state according to the current version's spec.
		*/
		atDocument() {
			const res = new Directives(this.yaml, this.tags);
			switch (this.yaml.version) {
				case "1.1":
					this.atNextDocument = true;
					break;
				case "1.2":
					this.atNextDocument = false;
					this.yaml = {
						explicit: Directives.defaultYaml.explicit,
						version: "1.2"
					};
					this.tags = Object.assign({}, Directives.defaultTags);
			}
			return res;
		}
		/**
		* @param onError - May be called even if the action was successful
		* @returns `true` on success
		*/
		add(line, onError) {
			if (this.atNextDocument) {
				this.yaml = {
					explicit: Directives.defaultYaml.explicit,
					version: "1.1"
				};
				this.tags = Object.assign({}, Directives.defaultTags);
				this.atNextDocument = false;
			}
			const parts = line.trim().split(/[ \t]+/);
			const name = parts.shift();
			switch (name) {
				case "%TAG": {
					if (parts.length !== 2) {
						onError(0, "%TAG directive should contain exactly two parts");
						if (parts.length < 2) return false;
					}
					const [handle, prefix] = parts;
					this.tags[handle] = prefix;
					return true;
				}
				case "%YAML": {
					this.yaml.explicit = true;
					if (parts.length !== 1) {
						onError(0, "%YAML directive should contain exactly one part");
						return false;
					}
					const [version] = parts;
					if (version === "1.1" || version === "1.2") {
						this.yaml.version = version;
						return true;
					} else {
						const isValid = /^\d+\.\d+$/.test(version);
						onError(6, `Unsupported YAML version ${version}`, isValid);
						return false;
					}
				}
				default:
					onError(0, `Unknown directive ${name}`, true);
					return false;
			}
		}
		/**
		* Resolves a tag, matching handles to those defined in %TAG directives.
		*
		* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
		*   `'!local'` tag, or `null` if unresolvable.
		*/
		tagName(source, onError) {
			if (source === "!") return "!";
			if (source[0] !== "!") {
				onError(`Not a valid tag: ${source}`);
				return null;
			}
			if (source[1] === "<") {
				const verbatim = source.slice(2, -1);
				if (verbatim === "!" || verbatim === "!!") {
					onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
					return null;
				}
				if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
				return verbatim;
			}
			const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
			if (!suffix) onError(`The ${source} tag has no suffix`);
			const prefix = this.tags[handle];
			if (prefix) try {
				return prefix + decodeURIComponent(suffix);
			} catch (error) {
				onError(String(error));
				return null;
			}
			if (handle === "!") return source;
			onError(`Could not resolve tag: ${source}`);
			return null;
		}
		/**
		* Given a fully resolved tag, returns its printable string form,
		* taking into account current tag prefixes and defaults.
		*/
		tagString(tag) {
			for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
			return tag[0] === "!" ? tag : `!<${tag}>`;
		}
		toString(doc) {
			const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
			const tagEntries = Object.entries(this.tags);
			let tagNames;
			if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
				const tags = {};
				visit.visit(doc.contents, (_key, node) => {
					if (identity.isNode(node) && node.tag) tags[node.tag] = true;
				});
				tagNames = Object.keys(tags);
			} else tagNames = [];
			for (const [handle, prefix] of tagEntries) {
				if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
				if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
			}
			return lines.join("\n");
		}
	};
	Directives.defaultYaml = {
		explicit: false,
		version: "1.2"
	};
	Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
	exports.Directives = Directives;
}));
// node_modules/yaml/dist/doc/anchors.js
var require_anchors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	/**
	* Verify that the input string is a valid anchor.
	*
	* Will throw on errors.
	*/
	function anchorIsValid(anchor) {
		if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
			const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
			throw new Error(msg);
		}
		return true;
	}
	function anchorNames(root) {
		const anchors = /* @__PURE__ */ new Set();
		visit.visit(root, { Value(_key, node) {
			if (node.anchor) anchors.add(node.anchor);
		} });
		return anchors;
	}
	/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
	function findNewAnchor(prefix, exclude) {
		for (let i = 1;; ++i) {
			const name = `${prefix}${i}`;
			if (!exclude.has(name)) return name;
		}
	}
	function createNodeAnchors(doc, prefix) {
		const aliasObjects = [];
		const sourceObjects = /* @__PURE__ */ new Map();
		let prevAnchors = null;
		return {
			onAnchor: (source) => {
				aliasObjects.push(source);
				prevAnchors ?? (prevAnchors = anchorNames(doc));
				const anchor = findNewAnchor(prefix, prevAnchors);
				prevAnchors.add(anchor);
				return anchor;
			},
			/**
			* With circular references, the source node is only resolved after all
			* of its child nodes are. This is why anchors are set only after all of
			* the nodes have been created.
			*/
			setAnchors: () => {
				for (const source of aliasObjects) {
					const ref = sourceObjects.get(source);
					if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) ref.node.anchor = ref.anchor;
					else {
						const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
						error.source = source;
						throw error;
					}
				}
			},
			sourceObjects
		};
	}
	exports.anchorIsValid = anchorIsValid;
	exports.anchorNames = anchorNames;
	exports.createNodeAnchors = createNodeAnchors;
	exports.findNewAnchor = findNewAnchor;
}));
// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
	* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
	* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
	*
	* Includes extensions for handling Map and Set objects.
	*/
	function applyReviver(reviver, obj, key, val) {
		if (val && typeof val === "object") {
			if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
				const v0 = val[i];
				const v1 = applyReviver(reviver, val, String(i), v0);
				if (v1 === void 0) delete val[i];
				else if (v1 !== v0) val[i] = v1;
			}
			else if (val instanceof Map) for (const k of Array.from(val.keys())) {
				const v0 = val.get(k);
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) val.delete(k);
				else if (v1 !== v0) val.set(k, v1);
			}
			else if (val instanceof Set) for (const v0 of Array.from(val)) {
				const v1 = applyReviver(reviver, val, v0, v0);
				if (v1 === void 0) val.delete(v0);
				else if (v1 !== v0) {
					val.delete(v0);
					val.add(v1);
				}
			}
			else for (const [k, v0] of Object.entries(val)) {
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) delete val[k];
				else if (v1 !== v0) val[k] = v1;
			}
		}
		return reviver.call(obj, key, val);
	}
	exports.applyReviver = applyReviver;
}));
// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	/**
	* Recursively convert any node or its contents to native JavaScript
	*
	* @param value - The input value
	* @param arg - If `value` defines a `toJSON()` method, use this
	*   as its first argument
	* @param ctx - Conversion context, originally set in Document#toJS(). If
	*   `{ keep: true }` is not set, output should be suitable for JSON
	*   stringification.
	*/
	function toJS(value, arg, ctx) {
		if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
		if (value && typeof value.toJSON === "function") {
			if (!ctx || !identity.hasAnchor(value)) return value.toJSON(arg, ctx);
			const data = {
				aliasCount: 0,
				count: 1,
				res: void 0
			};
			ctx.anchors.set(value, data);
			ctx.onCreate = (res) => {
				data.res = res;
				delete ctx.onCreate;
			};
			const res = value.toJSON(arg, ctx);
			if (ctx.onCreate) ctx.onCreate(res);
			return res;
		}
		if (typeof value === "bigint" && !ctx?.keep) return Number(value);
		return value;
	}
	exports.toJS = toJS;
}));
// node_modules/yaml/dist/nodes/Node.js
var require_Node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var applyReviver = require_applyReviver();
	var identity = require_identity();
	var toJS = require_toJS();
	var NodeBase = class {
		constructor(type) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: type });
		}
		/** Create a copy of this node.  */
		clone() {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** A plain JavaScript representation of this node. */
		toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			if (!identity.isDocument(doc)) throw new TypeError("A document argument is required");
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc,
				keep: true,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this, "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
	};
	exports.NodeBase = NodeBase;
}));
// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var visit = require_visit();
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	var Alias = class extends Node.NodeBase {
		constructor(source) {
			super(identity.ALIAS);
			this.source = source;
			Object.defineProperty(this, "tag", { set() {
				throw new Error("Alias nodes cannot have tags");
			} });
		}
		/**
		* Resolve the value of this alias within `doc`, finding the last
		* instance of the `source` anchor before this node.
		*/
		resolve(doc, ctx) {
			if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
			let nodes;
			if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
			else {
				nodes = [];
				visit.visit(doc, { Node: (_key, node) => {
					if (identity.isAlias(node) || identity.hasAnchor(node)) nodes.push(node);
				} });
				if (ctx) ctx.aliasResolveCache = nodes;
			}
			let found = void 0;
			for (const node of nodes) {
				if (node === this) break;
				if (node.anchor === this.source) found = node;
			}
			if (found && ctx) {
				const { anchors, doc, maxAliasCount } = ctx;
				let data = anchors.get(found);
				if (!data) {
					toJS.toJS(found, null, ctx);
					data = anchors.get(found);
				}
				/* istanbul ignore if */
				if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
				if (maxAliasCount >= 0) {
					data.count += 1;
					if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, found, anchors);
					if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
				}
			}
			return found;
		}
		toJSON(_arg, ctx) {
			if (!ctx) return { source: this.source };
			const source = this.resolve(ctx.doc, ctx);
			if (!source) {
				const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
				throw new ReferenceError(msg);
			}
			return ctx.anchors.get(source).res;
		}
		toString(ctx, _onComment, _onChompKeep) {
			const src = `*${this.source}`;
			if (ctx) {
				anchors.anchorIsValid(this.source);
				if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
					const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
					throw new Error(msg);
				}
				if (ctx.implicitKey) return `${src} `;
			}
			return src;
		}
	};
	function getAliasCount(doc, node, anchors) {
		if (identity.isAlias(node)) {
			const source = node.resolve(doc);
			const anchor = anchors && source && anchors.get(source);
			return anchor ? anchor.count * anchor.aliasCount : 0;
		} else if (identity.isCollection(node)) {
			let count = 0;
			for (const item of node.items) {
				const c = getAliasCount(doc, item, anchors);
				if (c > count) count = c;
			}
			return count;
		} else if (identity.isPair(node)) {
			const kc = getAliasCount(doc, node.key, anchors);
			const vc = getAliasCount(doc, node.value, anchors);
			return Math.max(kc, vc);
		}
		return 1;
	}
	exports.Alias = Alias;
}));
// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
	var Scalar = class extends Node.NodeBase {
		constructor(value) {
			super(identity.SCALAR);
			this.value = value;
		}
		toJSON(arg, ctx) {
			return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
		}
		toString() {
			return String(this.value);
		}
	};
	Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
	Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
	Scalar.PLAIN = "PLAIN";
	Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
	Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
	exports.Scalar = Scalar;
	exports.isScalarValue = isScalarValue;
}));
// node_modules/yaml/dist/doc/createNode.js
var require_createNode = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var Scalar = require_Scalar();
	var defaultTagPrefix = "tag:yaml.org,2002:";
	function findTagObject(value, tagName, tags) {
		if (tagName) {
			const match = tags.filter((t) => t.tag === tagName);
			const tagObj = match.find((t) => !t.format) ?? match[0];
			if (!tagObj) throw new Error(`Tag ${tagName} not found`);
			return tagObj;
		}
		return tags.find((t) => t.identify?.(value) && !t.format);
	}
	function createNode(value, tagName, ctx) {
		if (identity.isDocument(value)) value = value.contents;
		if (identity.isNode(value)) return value;
		if (identity.isPair(value)) {
			const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
			map.items.push(value);
			return map;
		}
		if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
		const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
		let ref = void 0;
		if (aliasDuplicateObjects && value && typeof value === "object") {
			ref = sourceObjects.get(value);
			if (ref) {
				ref.anchor ?? (ref.anchor = onAnchor(value));
				return new Alias.Alias(ref.anchor);
			} else {
				ref = {
					anchor: null,
					node: null
				};
				sourceObjects.set(value, ref);
			}
		}
		if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
		let tagObj = findTagObject(value, tagName, schema.tags);
		if (!tagObj) {
			if (value && typeof value.toJSON === "function") value = value.toJSON();
			if (!value || typeof value !== "object") {
				const node = new Scalar.Scalar(value);
				if (ref) ref.node = node;
				return node;
			}
			tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
		}
		if (onTagObj) {
			onTagObj(tagObj);
			delete ctx.onTagObj;
		}
		const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
		if (tagName) node.tag = tagName;
		else if (!tagObj.default) node.tag = tagObj.tag;
		if (ref) ref.node = node;
		return node;
	}
	exports.createNode = createNode;
}));
// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var identity = require_identity();
	var Node = require_Node();
	function collectionFromPath(schema, path, value) {
		let v = value;
		for (let i = path.length - 1; i >= 0; --i) {
			const k = path[i];
			if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
				const a = [];
				a[k] = v;
				v = a;
			} else v = /* @__PURE__ */ new Map([[k, v]]);
		}
		return createNode.createNode(v, void 0, {
			aliasDuplicateObjects: false,
			keepUndefined: false,
			onAnchor: () => {
				throw new Error("This should not happen, please report a bug.");
			},
			schema,
			sourceObjects: /* @__PURE__ */ new Map()
		});
	}
	var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
	var Collection = class extends Node.NodeBase {
		constructor(type, schema) {
			super(type);
			Object.defineProperty(this, "schema", {
				value: schema,
				configurable: true,
				enumerable: false,
				writable: true
			});
		}
		/**
		* Create a copy of this collection.
		*
		* @param schema - If defined, overwrites the original's schema
		*/
		clone(schema) {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (schema) copy.schema = schema;
			copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/**
		* Adds a value to the collection. For `!!map` and `!!omap` the value must
		* be a Pair instance or a `{ key, value }` object, which may not have a key
		* that already exists in the map.
		*/
		addIn(path, value) {
			if (isEmptyPath(path)) this.add(value);
			else {
				const [key, ...rest] = path;
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.addIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
		/**
		* Removes a value from the collection.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.delete(key);
			const node = this.get(key, true);
			if (identity.isCollection(node)) return node.deleteIn(rest);
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			const [key, ...rest] = path;
			const node = this.get(key, true);
			if (rest.length === 0) return !keepScalar && identity.isScalar(node) ? node.value : node;
			else return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
		}
		hasAllNullValues(allowScalar) {
			return this.items.every((node) => {
				if (!identity.isPair(node)) return false;
				const n = node.value;
				return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
			});
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*/
		hasIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.has(key);
			const node = this.get(key, true);
			return identity.isCollection(node) ? node.hasIn(rest) : false;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			const [key, ...rest] = path;
			if (rest.length === 0) this.set(key, value);
			else {
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.setIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
	};
	exports.Collection = Collection;
	exports.collectionFromPath = collectionFromPath;
	exports.isEmptyPath = isEmptyPath;
}));
// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringifies a comment.
	*
	* Empty comment lines are left empty,
	* lines consisting of a single space are replaced by `#`,
	* and all other lines are prefixed with a `#`.
	*/
	var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
	function indentComment(comment, indent) {
		if (/^\n+$/.test(comment)) return comment.substring(1);
		return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
	}
	var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
	exports.indentComment = indentComment;
	exports.lineComment = lineComment;
	exports.stringifyComment = stringifyComment;
}));
// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = /* @__PURE__ */ __commonJSMin(((exports) => {
	var FOLD_FLOW = "flow";
	var FOLD_BLOCK = "block";
	var FOLD_QUOTED = "quoted";
	/**
	* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
	* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
	* terminated with `\n` and started with `indent`.
	*/
	function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
		if (!lineWidth || lineWidth < 0) return text;
		if (lineWidth < minContentWidth) minContentWidth = 0;
		const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
		if (text.length <= endStep) return text;
		const folds = [];
		const escapedFolds = {};
		let end = lineWidth - indent.length;
		if (typeof indentAtStart === "number") {
			if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
			else end = lineWidth - indentAtStart;
		}
		let split = void 0;
		let prev = void 0;
		let overflow = false;
		let i = -1;
		let escStart = -1;
		let escEnd = -1;
		if (mode === FOLD_BLOCK) {
			i = consumeMoreIndentedLines(text, i, indent.length);
			if (i !== -1) end = i + endStep;
		}
		for (let ch; ch = text[i += 1];) {
			if (mode === FOLD_QUOTED && ch === "\\") {
				escStart = i;
				switch (text[i + 1]) {
					case "x":
						i += 3;
						break;
					case "u":
						i += 5;
						break;
					case "U":
						i += 9;
						break;
					default: i += 1;
				}
				escEnd = i;
			}
			if (ch === "\n") {
				if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i, indent.length);
				end = i + indent.length + endStep;
				split = void 0;
			} else {
				if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
					const next = text[i + 1];
					if (next && next !== " " && next !== "\n" && next !== "	") split = i;
				}
				if (i >= end) {
					if (split) {
						folds.push(split);
						end = split + endStep;
						split = void 0;
					} else if (mode === FOLD_QUOTED) {
						while (prev === " " || prev === "	") {
							prev = ch;
							ch = text[i += 1];
							overflow = true;
						}
						const j = i > escEnd + 1 ? i - 2 : escStart - 1;
						if (escapedFolds[j]) return text;
						folds.push(j);
						escapedFolds[j] = true;
						end = j + endStep;
						split = void 0;
					} else overflow = true;
				}
			}
			prev = ch;
		}
		if (overflow && onOverflow) onOverflow();
		if (folds.length === 0) return text;
		if (onFold) onFold();
		let res = text.slice(0, folds[0]);
		for (let i = 0; i < folds.length; ++i) {
			const fold = folds[i];
			const end = folds[i + 1] || text.length;
			if (fold === 0) res = `\n${indent}${text.slice(0, end)}`;
			else {
				if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
				res += `\n${indent}${text.slice(fold + 1, end)}`;
			}
		}
		return res;
	}
	/**
	* Presumes `i + 1` is at the start of a line
	* @returns index of last newline in more-indented block
	*/
	function consumeMoreIndentedLines(text, i, indent) {
		let end = i;
		let start = i + 1;
		let ch = text[start];
		while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
		else {
			do
				ch = text[++i];
			while (ch && ch !== "\n");
			end = i;
			start = i + 1;
			ch = text[start];
		}
		return end;
	}
	exports.FOLD_BLOCK = FOLD_BLOCK;
	exports.FOLD_FLOW = FOLD_FLOW;
	exports.FOLD_QUOTED = FOLD_QUOTED;
	exports.foldFlowLines = foldFlowLines;
}));
// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var foldFlowLines = require_foldFlowLines();
	var getFoldOptions = (ctx, isBlock) => ({
		indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
		lineWidth: ctx.options.lineWidth,
		minContentWidth: ctx.options.minContentWidth
	});
	var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
	function lineLengthOverLimit(str, lineWidth, indentLength) {
		if (!lineWidth || lineWidth < 0) return false;
		const limit = lineWidth - indentLength;
		const strLen = str.length;
		if (strLen <= limit) return false;
		for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
			if (i - start > limit) return true;
			start = i + 1;
			if (strLen - start <= limit) return false;
		}
		return true;
	}
	function doubleQuotedString(value, ctx) {
		const json = JSON.stringify(value);
		if (ctx.options.doubleQuotedAsJSON) return json;
		const { implicitKey } = ctx;
		const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		let str = "";
		let start = 0;
		for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
			if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
				str += json.slice(start, i) + "\\ ";
				i += 1;
				start = i;
				ch = "\\";
			}
			if (ch === "\\") switch (json[i + 1]) {
				case "u":
					{
						str += json.slice(start, i);
						const code = json.substr(i + 2, 4);
						switch (code) {
							case "0000":
								str += "\\0";
								break;
							case "0007":
								str += "\\a";
								break;
							case "000b":
								str += "\\v";
								break;
							case "001b":
								str += "\\e";
								break;
							case "0085":
								str += "\\N";
								break;
							case "00a0":
								str += "\\_";
								break;
							case "2028":
								str += "\\L";
								break;
							case "2029":
								str += "\\P";
								break;
							default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
							else str += json.substr(i, 6);
						}
						i += 5;
						start = i + 1;
					}
					break;
				case "n":
					if (implicitKey || json[i + 2] === "\"" || json.length < minMultiLineLength) i += 1;
					else {
						str += json.slice(start, i) + "\n\n";
						while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== "\"") {
							str += "\n";
							i += 2;
						}
						str += indent;
						if (json[i + 2] === " ") str += "\\";
						i += 1;
						start = i + 1;
					}
					break;
				default: i += 1;
			}
		}
		str = start ? str + json.slice(start) : json;
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
	}
	function singleQuotedString(value, ctx) {
		if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
		return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function quotedString(value, ctx) {
		const { singleQuote } = ctx.options;
		let qs;
		if (singleQuote === false) qs = doubleQuotedString;
		else {
			const hasDouble = value.includes("\"");
			const hasSingle = value.includes("'");
			if (hasDouble && !hasSingle) qs = singleQuotedString;
			else if (hasSingle && !hasDouble) qs = doubleQuotedString;
			else qs = singleQuote ? singleQuotedString : doubleQuotedString;
		}
		return qs(value, ctx);
	}
	var blockEndNewlines;
	try {
		blockEndNewlines = /* @__PURE__ */ new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
	} catch {
		blockEndNewlines = /\n+(?!\n|$)/g;
	}
	function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
		const { blockQuote, commentString, lineWidth } = ctx.options;
		if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
		const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
		const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
		if (!value) return literal ? "|\n" : ">\n";
		let chomp;
		let endStart;
		for (endStart = value.length; endStart > 0; --endStart) {
			const ch = value[endStart - 1];
			if (ch !== "\n" && ch !== "	" && ch !== " ") break;
		}
		let end = value.substring(endStart);
		const endNlPos = end.indexOf("\n");
		if (endNlPos === -1) chomp = "-";
		else if (value === end || endNlPos !== end.length - 1) {
			chomp = "+";
			if (onChompKeep) onChompKeep();
		} else chomp = "";
		if (end) {
			value = value.slice(0, -end.length);
			if (end[end.length - 1] === "\n") end = end.slice(0, -1);
			end = end.replace(blockEndNewlines, `$&${indent}`);
		}
		let startWithSpace = false;
		let startEnd;
		let startNlPos = -1;
		for (startEnd = 0; startEnd < value.length; ++startEnd) {
			const ch = value[startEnd];
			if (ch === " ") startWithSpace = true;
			else if (ch === "\n") startNlPos = startEnd;
			else break;
		}
		let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
		if (start) {
			value = value.substring(start.length);
			start = start.replace(/\n+/g, `$&${indent}`);
		}
		let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
		if (comment) {
			header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
			if (onComment) onComment();
		}
		if (!literal) {
			const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
			let literalFallback = false;
			const foldOptions = getFoldOptions(ctx, true);
			if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
				literalFallback = true;
			};
			const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
			if (!literalFallback) return `>${header}\n${indent}${body}`;
		}
		value = value.replace(/\n+/g, `$&${indent}`);
		return `|${header}\n${indent}${start}${value}${end}`;
	}
	function plainString(item, ctx, onComment, onChompKeep) {
		const { type, value } = item;
		const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
		if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
		if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
		if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
		if (containsDocumentMarker(value)) {
			if (indent === "") {
				ctx.forceBlockIndent = true;
				return blockString(item, ctx, onComment, onChompKeep);
			} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
		}
		const str = value.replace(/\n+/g, `$&\n${indent}`);
		if (actualString) {
			const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
			const { compat, tags } = ctx.doc.schema;
			if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
		}
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function stringifyString(item, ctx, onComment, onChompKeep) {
		const { implicitKey, inFlow } = ctx;
		const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
		let { type } = item;
		if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
			if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar.Scalar.QUOTE_DOUBLE;
		}
		const _stringify = (_type) => {
			switch (_type) {
				case Scalar.Scalar.BLOCK_FOLDED:
				case Scalar.Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
				case Scalar.Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
				case Scalar.Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
				case Scalar.Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
				default: return null;
			}
		};
		let res = _stringify(type);
		if (res === null) {
			const { defaultKeyType, defaultStringType } = ctx.options;
			const t = implicitKey && defaultKeyType || defaultStringType;
			res = _stringify(t);
			if (res === null) throw new Error(`Unsupported default string type ${t}`);
		}
		return res;
	}
	exports.stringifyString = stringifyString;
}));
// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var identity = require_identity();
	var stringifyComment = require_stringifyComment();
	var stringifyString = require_stringifyString();
	function createStringifyContext(doc, options) {
		const opt = Object.assign({
			blockQuote: true,
			commentString: stringifyComment.stringifyComment,
			defaultKeyType: null,
			defaultStringType: "PLAIN",
			directives: null,
			doubleQuotedAsJSON: false,
			doubleQuotedMinMultiLineLength: 40,
			falseStr: "false",
			flowCollectionPadding: true,
			indentSeq: true,
			lineWidth: 80,
			minContentWidth: 20,
			nullStr: "null",
			simpleKeys: false,
			singleQuote: null,
			trailingComma: false,
			trueStr: "true",
			verifyAliasOrder: true
		}, doc.schema.toStringOptions, options);
		let inFlow;
		switch (opt.collectionStyle) {
			case "block":
				inFlow = false;
				break;
			case "flow":
				inFlow = true;
				break;
			default: inFlow = null;
		}
		return {
			anchors: /* @__PURE__ */ new Set(),
			doc,
			flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
			indent: "",
			indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
			inFlow,
			options: opt
		};
	}
	function getTagObject(tags, item) {
		if (item.tag) {
			const match = tags.filter((t) => t.tag === item.tag);
			if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
		}
		let tagObj = void 0;
		let obj;
		if (identity.isScalar(item)) {
			obj = item.value;
			let match = tags.filter((t) => t.identify?.(obj));
			if (match.length > 1) {
				const testMatch = match.filter((t) => t.test);
				if (testMatch.length > 0) match = testMatch;
			}
			tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
		} else {
			obj = item;
			tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
		}
		if (!tagObj) {
			const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
			throw new Error(`Tag not resolved for ${name} value`);
		}
		return tagObj;
	}
	function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
		if (!doc.directives) return "";
		const props = [];
		const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
		if (anchor && anchors.anchorIsValid(anchor)) {
			anchors$1.add(anchor);
			props.push(`&${anchor}`);
		}
		const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
		if (tag) props.push(doc.directives.tagString(tag));
		return props.join(" ");
	}
	function stringify(item, ctx, onComment, onChompKeep) {
		if (identity.isPair(item)) return item.toString(ctx, onComment, onChompKeep);
		if (identity.isAlias(item)) {
			if (ctx.doc.directives) return item.toString(ctx);
			if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
			else {
				if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
				else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
				item = item.resolve(ctx.doc);
			}
		}
		let tagObj = void 0;
		const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
		tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
		const props = stringifyProps(node, tagObj, ctx);
		if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
		const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
		if (!props) return str;
		return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
	}
	exports.createStringifyContext = createStringifyContext;
	exports.stringify = stringify;
}));
// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
		const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
		let keyComment = identity.isNode(key) && key.comment || null;
		if (simpleKeys) {
			if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
			if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
		}
		let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
		ctx = Object.assign({}, ctx, {
			allNullValues: false,
			implicitKey: !explicitKey && (simpleKeys || !allNullValues),
			indent: indent + indentStep
		});
		let keyCommentDone = false;
		let chompKeep = false;
		let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
		if (!explicitKey && !ctx.inFlow && str.length > 1024) {
			if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
			explicitKey = true;
		}
		if (ctx.inFlow) {
			if (allNullValues || value == null) {
				if (keyCommentDone && onComment) onComment();
				return str === "" ? "?" : explicitKey ? `? ${str}` : str;
			}
		} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
			str = `? ${str}`;
			if (keyComment && !keyCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		if (keyCommentDone) keyComment = null;
		if (explicitKey) {
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			str = `? ${str}\n${indent}:`;
		} else {
			str = `${str}:`;
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
		}
		let vsb, vcb, valueComment;
		if (identity.isNode(value)) {
			vsb = !!value.spaceBefore;
			vcb = value.commentBefore;
			valueComment = value.comment;
		} else {
			vsb = false;
			vcb = null;
			valueComment = null;
			if (value && typeof value === "object") value = doc.createNode(value);
		}
		ctx.implicitKey = false;
		if (!explicitKey && !keyComment && identity.isScalar(value)) ctx.indentAtStart = str.length + 1;
		chompKeep = false;
		if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
		let valueCommentDone = false;
		const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
		let ws = " ";
		if (keyComment || vsb || vcb) {
			ws = vsb ? "\n" : "";
			if (vcb) {
				const cs = commentString(vcb);
				ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
			}
			if (valueStr === "" && !ctx.inFlow) {
				if (ws === "\n" && valueComment) ws = "\n\n";
			} else ws += `\n${ctx.indent}`;
		} else if (!explicitKey && identity.isCollection(value)) {
			const vs0 = valueStr[0];
			const nl0 = valueStr.indexOf("\n");
			const hasNewline = nl0 !== -1;
			const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
			if (hasNewline || !flow) {
				let hasPropsLine = false;
				if (hasNewline && (vs0 === "&" || vs0 === "!")) {
					let sp0 = valueStr.indexOf(" ");
					if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
					if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
				}
				if (!hasPropsLine) ws = `\n${ctx.indent}`;
			}
		} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
		str += ws + valueStr;
		if (ctx.inFlow) {
			if (valueCommentDone && onComment) onComment();
		} else if (valueComment && !valueCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
		else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	exports.stringifyPair = stringifyPair;
}));
// node_modules/yaml/dist/log.js
var require_log = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	function debug(logLevel, ...messages) {
		if (logLevel === "debug") console.log(...messages);
	}
	function warn(logLevel, warning) {
		if (logLevel === "debug" || logLevel === "warn") {
			if (typeof node_process.emitWarning === "function") node_process.emitWarning(warning);
			else console.warn(warning);
		}
	}
	exports.debug = debug;
	exports.warn = warn;
}));
// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var MERGE_KEY = "<<";
	var merge = {
		identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
		default: "key",
		tag: "tag:yaml.org,2002:merge",
		test: /^<<$/,
		resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
		stringify: () => MERGE_KEY
	};
	var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
	function addMergeToJSMap(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (identity.isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
		else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
		else mergeValue(ctx, map, source);
	}
	function mergeValue(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (!identity.isMap(source)) throw new Error("Merge sources must be maps or map aliases");
		const srcMap = source.toJSON(null, ctx, Map);
		for (const [key, value] of srcMap) if (map instanceof Map) {
			if (!map.has(key)) map.set(key, value);
		} else if (map instanceof Set) map.add(key);
		else if (!Object.prototype.hasOwnProperty.call(map, key)) Object.defineProperty(map, key, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
		return map;
	}
	function resolveAliasValue(ctx, value) {
		return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
	}
	exports.addMergeToJSMap = addMergeToJSMap;
	exports.isMergeKey = isMergeKey;
	exports.merge = merge;
}));
// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var log = require_log();
	var merge = require_merge();
	var stringify = require_stringify();
	var identity = require_identity();
	var toJS = require_toJS();
	function addPairToJSMap(ctx, map, { key, value }) {
		if (identity.isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
		else if (merge.isMergeKey(ctx, key)) merge.addMergeToJSMap(ctx, map, value);
		else {
			const jsKey = toJS.toJS(key, "", ctx);
			if (map instanceof Map) map.set(jsKey, toJS.toJS(value, jsKey, ctx));
			else if (map instanceof Set) map.add(jsKey);
			else {
				const stringKey = stringifyKey(key, jsKey, ctx);
				const jsValue = toJS.toJS(value, stringKey, ctx);
				if (stringKey in map) Object.defineProperty(map, stringKey, {
					value: jsValue,
					writable: true,
					enumerable: true,
					configurable: true
				});
				else map[stringKey] = jsValue;
			}
		}
		return map;
	}
	function stringifyKey(key, jsKey, ctx) {
		if (jsKey === null) return "";
		if (typeof jsKey !== "object") return String(jsKey);
		if (identity.isNode(key) && ctx?.doc) {
			const strCtx = stringify.createStringifyContext(ctx.doc, {});
			strCtx.anchors = /* @__PURE__ */ new Set();
			for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
			strCtx.inFlow = true;
			strCtx.inStringifyKey = true;
			const strKey = key.toString(strCtx);
			if (!ctx.mapKeyWarned) {
				let jsonStr = JSON.stringify(strKey);
				if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
				log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
				ctx.mapKeyWarned = true;
			}
			return strKey;
		}
		return JSON.stringify(jsKey);
	}
	exports.addPairToJSMap = addPairToJSMap;
}));
// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyPair = require_stringifyPair();
	var addPairToJSMap = require_addPairToJSMap();
	var identity = require_identity();
	function createPair(key, value, ctx) {
		return new Pair(createNode.createNode(key, void 0, ctx), createNode.createNode(value, void 0, ctx));
	}
	var Pair = class Pair {
		constructor(key, value = null) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
			this.key = key;
			this.value = value;
		}
		clone(schema) {
			let { key, value } = this;
			if (identity.isNode(key)) key = key.clone(schema);
			if (identity.isNode(value)) value = value.clone(schema);
			return new Pair(key, value);
		}
		toJSON(_, ctx) {
			const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			return addPairToJSMap.addPairToJSMap(ctx, pair, this);
		}
		toString(ctx, onComment, onChompKeep) {
			return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
		}
	};
	exports.Pair = Pair;
	exports.createPair = createPair;
}));
// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyCollection(collection, ctx, options) {
		return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
	}
	function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
		const { indent, options: { commentString } } = ctx;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			type: null
		});
		let chompKeep = false;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (!chompKeep && item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (!chompKeep && ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
				}
			}
			chompKeep = false;
			let str = stringify.stringify(item, itemCtx, () => comment = null, () => chompKeep = true);
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			if (chompKeep && comment) chompKeep = false;
			lines.push(blockItemPrefix + str);
		}
		let str;
		if (lines.length === 0) str = flowChars.start + flowChars.end;
		else {
			str = lines[0];
			for (let i = 1; i < lines.length; ++i) {
				const line = lines[i];
				str += line ? `\n${indent}${line}` : "\n";
			}
		}
		if (comment) {
			str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
			if (onComment) onComment();
		} else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
		const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
		itemIndent += indentStep;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			inFlow: true,
			type: null
		});
		let reqNewline = false;
		let linesAtValue = 0;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, false);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, false);
					if (ik.comment) reqNewline = true;
				}
				const iv = identity.isNode(item.value) ? item.value : null;
				if (iv) {
					if (iv.comment) comment = iv.comment;
					if (iv.commentBefore) reqNewline = true;
				} else if (item.value == null && ik?.comment) comment = ik.comment;
			}
			if (comment) reqNewline = true;
			let str = stringify.stringify(item, itemCtx, () => comment = null);
			reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
			if (i < items.length - 1) str += ",";
			else if (ctx.options.trailingComma) {
				if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
				if (reqNewline) str += ",";
			}
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			lines.push(str);
			linesAtValue = lines.length;
		}
		const { start, end } = flowChars;
		if (lines.length === 0) return start + end;
		else {
			if (!reqNewline) {
				const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
				reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
			}
			if (reqNewline) {
				let str = start;
				for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
				return `${str}\n${indent}${end}`;
			} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
		}
	}
	function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
		if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
		if (comment) {
			const ic = stringifyComment.indentComment(commentString(comment), indent);
			lines.push(ic.trimStart());
		}
	}
	exports.stringifyCollection = stringifyCollection;
}));
// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyCollection = require_stringifyCollection();
	var addPairToJSMap = require_addPairToJSMap();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	function findPair(items, key) {
		const k = identity.isScalar(key) ? key.value : key;
		for (const it of items) if (identity.isPair(it)) {
			if (it.key === key || it.key === k) return it;
			if (identity.isScalar(it.key) && it.key.value === k) return it;
		}
	}
	var YAMLMap = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:map";
		}
		constructor(schema) {
			super(identity.MAP, schema);
			this.items = [];
		}
		/**
		* A generic collection parsing method that can be extended
		* to other node classes that inherit from YAMLMap
		*/
		static from(schema, obj, ctx) {
			const { keepUndefined, replacer } = ctx;
			const map = new this(schema);
			const add = (key, value) => {
				if (typeof replacer === "function") value = replacer.call(obj, key, value);
				else if (Array.isArray(replacer) && !replacer.includes(key)) return;
				if (value !== void 0 || keepUndefined) map.items.push(Pair.createPair(key, value, ctx));
			};
			if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
			else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
			if (typeof schema.sortMapEntries === "function") map.items.sort(schema.sortMapEntries);
			return map;
		}
		/**
		* Adds a value to the collection.
		*
		* @param overwrite - If not set `true`, using a key that is already in the
		*   collection will throw. Otherwise, overwrites the previous value.
		*/
		add(pair, overwrite) {
			let _pair;
			if (identity.isPair(pair)) _pair = pair;
			else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair.Pair(pair, pair?.value);
			else _pair = new Pair.Pair(pair.key, pair.value);
			const prev = findPair(this.items, _pair.key);
			const sortEntries = this.schema?.sortMapEntries;
			if (prev) {
				if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
				if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value)) prev.value.value = _pair.value;
				else prev.value = _pair.value;
			} else if (sortEntries) {
				const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
				if (i === -1) this.items.push(_pair);
				else this.items.splice(i, 0, _pair);
			} else this.items.push(_pair);
		}
		delete(key) {
			const it = findPair(this.items, key);
			if (!it) return false;
			return this.items.splice(this.items.indexOf(it), 1).length > 0;
		}
		get(key, keepScalar) {
			const node = findPair(this.items, key)?.value;
			return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
		}
		has(key) {
			return !!findPair(this.items, key);
		}
		set(key, value) {
			this.add(new Pair.Pair(key, value), true);
		}
		/**
		* @param ctx - Conversion context, originally set in Document#toJS()
		* @param {Class} Type - If set, forces the returned collection type
		* @returns Instance of Type, Map, or Object
		*/
		toJSON(_, ctx, Type) {
			const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const item of this.items) addPairToJSMap.addPairToJSMap(ctx, map, item);
			return map;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			for (const item of this.items) if (!identity.isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
			if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "",
				flowChars: {
					start: "{",
					end: "}"
				},
				itemIndent: ctx.indent || "",
				onChompKeep,
				onComment
			});
		}
	};
	exports.YAMLMap = YAMLMap;
	exports.findPair = findPair;
}));
// node_modules/yaml/dist/schema/common/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLMap = require_YAMLMap();
	exports.map = {
		collection: "map",
		default: true,
		nodeClass: YAMLMap.YAMLMap,
		tag: "tag:yaml.org,2002:map",
		resolve(map, onError) {
			if (!identity.isMap(map)) onError("Expected a mapping for this tag");
			return map;
		},
		createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
	};
}));
// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyCollection = require_stringifyCollection();
	var Collection = require_Collection();
	var identity = require_identity();
	var Scalar = require_Scalar();
	var toJS = require_toJS();
	var YAMLSeq = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:seq";
		}
		constructor(schema) {
			super(identity.SEQ, schema);
			this.items = [];
		}
		add(value) {
			this.items.push(value);
		}
		/**
		* Removes a value from the collection.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return false;
			return this.items.splice(idx, 1).length > 0;
		}
		get(key, keepScalar) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return void 0;
			const it = this.items[idx];
			return !keepScalar && identity.isScalar(it) ? it.value : it;
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*/
		has(key) {
			const idx = asItemIndex(key);
			return typeof idx === "number" && idx < this.items.length;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*
		* If `key` does not contain a representation of an integer, this will throw.
		* It may be wrapped in a `Scalar`.
		*/
		set(key, value) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
			const prev = this.items[idx];
			if (identity.isScalar(prev) && Scalar.isScalarValue(value)) prev.value = value;
			else this.items[idx] = value;
		}
		toJSON(_, ctx) {
			const seq = [];
			if (ctx?.onCreate) ctx.onCreate(seq);
			let i = 0;
			for (const item of this.items) seq.push(toJS.toJS(item, String(i++), ctx));
			return seq;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "- ",
				flowChars: {
					start: "[",
					end: "]"
				},
				itemIndent: (ctx.indent || "") + "  ",
				onChompKeep,
				onComment
			});
		}
		static from(schema, obj, ctx) {
			const { replacer } = ctx;
			const seq = new this(schema);
			if (obj && Symbol.iterator in Object(obj)) {
				let i = 0;
				for (let it of obj) {
					if (typeof replacer === "function") {
						const key = obj instanceof Set ? it : String(i++);
						it = replacer.call(obj, key, it);
					}
					seq.items.push(createNode.createNode(it, void 0, ctx));
				}
			}
			return seq;
		}
	};
	function asItemIndex(key) {
		let idx = identity.isScalar(key) ? key.value : key;
		if (idx && typeof idx === "string") idx = Number(idx);
		return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
	}
	exports.YAMLSeq = YAMLSeq;
}));
// node_modules/yaml/dist/schema/common/seq.js
var require_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLSeq = require_YAMLSeq();
	exports.seq = {
		collection: "seq",
		default: true,
		nodeClass: YAMLSeq.YAMLSeq,
		tag: "tag:yaml.org,2002:seq",
		resolve(seq, onError) {
			if (!identity.isSeq(seq)) onError("Expected a sequence for this tag");
			return seq;
		},
		createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
	};
}));
// node_modules/yaml/dist/schema/common/string.js
var require_string = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyString = require_stringifyString();
	exports.string = {
		identify: (value) => typeof value === "string",
		default: true,
		tag: "tag:yaml.org,2002:str",
		resolve: (str) => str,
		stringify(item, ctx, onComment, onChompKeep) {
			ctx = Object.assign({ actualString: true }, ctx);
			return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
		}
	};
}));
// node_modules/yaml/dist/schema/common/null.js
var require_null = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var nullTag = {
		identify: (value) => value == null,
		createNode: () => new Scalar.Scalar(null),
		default: true,
		tag: "tag:yaml.org,2002:null",
		test: /^(?:~|[Nn]ull|NULL)?$/,
		resolve: () => new Scalar.Scalar(null),
		stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
	};
	exports.nullTag = nullTag;
}));
// node_modules/yaml/dist/schema/core/bool.js
var require_bool$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var boolTag = {
		identify: (value) => typeof value === "boolean",
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
		resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
		stringify({ source, value }, ctx) {
			if (source && boolTag.test.test(source)) {
				if (value === (source[0] === "t" || source[0] === "T")) return source;
			}
			return value ? ctx.options.trueStr : ctx.options.falseStr;
		}
	};
	exports.boolTag = boolTag;
}));
// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = /* @__PURE__ */ __commonJSMin(((exports) => {
	function stringifyNumber({ format, minFractionDigits, tag, value }) {
		if (typeof value === "bigint") return String(value);
		const num = typeof value === "number" ? value : Number(value);
		if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
		let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
		if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
			let i = n.indexOf(".");
			if (i < 0) {
				i = n.length;
				n += ".";
			}
			let d = minFractionDigits - (n.length - i - 1);
			while (d-- > 0) n += "0";
		}
		return n;
	}
	exports.stringifyNumber = stringifyNumber;
}));
// node_modules/yaml/dist/schema/core/float.js
var require_float$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	var floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	var floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	exports.float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str));
			const dot = str.indexOf(".");
			if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));
// node_modules/yaml/dist/schema/core/int.js
var require_int$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value) && value >= 0) return prefix + value.toString(radix);
		return stringifyNumber.stringifyNumber(node);
	}
	var intOct = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^0o[0-7]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
		stringify: (node) => intStringify(node, 8, "0o")
	};
	var int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	var intHex = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^0x[0-9a-fA-F]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));
// node_modules/yaml/dist/schema/core/schema.js
var require_schema$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	exports.schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.boolTag,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float
	];
}));
// node_modules/yaml/dist/schema/json/schema.js
var require_schema$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var map = require_map();
	var seq = require_seq();
	function intIdentify(value) {
		return typeof value === "bigint" || Number.isInteger(value);
	}
	var stringifyJSON = ({ value }) => JSON.stringify(value);
	var jsonScalars = [
		{
			identify: (value) => typeof value === "string",
			default: true,
			tag: "tag:yaml.org,2002:str",
			resolve: (str) => str,
			stringify: stringifyJSON
		},
		{
			identify: (value) => value == null,
			createNode: () => new Scalar.Scalar(null),
			default: true,
			tag: "tag:yaml.org,2002:null",
			test: /^null$/,
			resolve: () => null,
			stringify: stringifyJSON
		},
		{
			identify: (value) => typeof value === "boolean",
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^true$|^false$/,
			resolve: (str) => str === "true",
			stringify: stringifyJSON
		},
		{
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^-?(?:0|[1-9][0-9]*)$/,
			resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
			stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
		},
		{
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
			resolve: (str) => parseFloat(str),
			stringify: stringifyJSON
		}
	];
	exports.schema = [map.map, seq.seq].concat(jsonScalars, {
		default: true,
		tag: "",
		test: /^/,
		resolve(str, onError) {
			onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
			return str;
		}
	});
}));
// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_buffer = __require("buffer");
	var Scalar = require_Scalar();
	var stringifyString = require_stringifyString();
	exports.binary = {
		identify: (value) => value instanceof Uint8Array,
		default: false,
		tag: "tag:yaml.org,2002:binary",
		/**
		* Returns a Buffer in node and an Uint8Array in browsers
		*
		* To use the resulting buffer as an image, you'll want to do something like:
		*
		*   const blob = new Blob([buffer], { type: 'image/jpeg' })
		*   document.querySelector('#photo').src = URL.createObjectURL(blob)
		*/
		resolve(src, onError) {
			if (typeof node_buffer.Buffer === "function") return node_buffer.Buffer.from(src, "base64");
			else if (typeof atob === "function") {
				const str = atob(src.replace(/[\n\r]/g, ""));
				const buffer = new Uint8Array(str.length);
				for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
				return buffer;
			} else {
				onError("This environment does not support reading binary tags; either Buffer or atob is required");
				return src;
			}
		},
		stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
			if (!value) return "";
			const buf = value;
			let str;
			if (typeof node_buffer.Buffer === "function") str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
			else if (typeof btoa === "function") {
				let s = "";
				for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
				str = btoa(s);
			} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
			type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
			if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
				const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
				const n = Math.ceil(str.length / lineWidth);
				const lines = new Array(n);
				for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
				str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
			}
			return stringifyString.stringifyString({
				comment,
				type,
				value: str
			}, ctx, onComment, onChompKeep);
		}
	};
}));
// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLSeq = require_YAMLSeq();
	function resolvePairs(seq, onError) {
		if (identity.isSeq(seq)) for (let i = 0; i < seq.items.length; ++i) {
			let item = seq.items[i];
			if (identity.isPair(item)) continue;
			else if (identity.isMap(item)) {
				if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
				const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
				if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
				if (item.comment) {
					const cn = pair.value ?? pair.key;
					cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
				}
				item = pair;
			}
			seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
		}
		else onError("Expected a sequence for this tag");
		return seq;
	}
	function createPairs(schema, iterable, ctx) {
		const { replacer } = ctx;
		const pairs = new YAMLSeq.YAMLSeq(schema);
		pairs.tag = "tag:yaml.org,2002:pairs";
		let i = 0;
		if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
			if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
			let key, value;
			if (Array.isArray(it)) {
				if (it.length === 2) {
					key = it[0];
					value = it[1];
				} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
			} else if (it && it instanceof Object) {
				const keys = Object.keys(it);
				if (keys.length === 1) {
					key = keys[0];
					value = it[key];
				} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
			} else key = it;
			pairs.items.push(Pair.createPair(key, value, ctx));
		}
		return pairs;
	}
	var pairs = {
		collection: "seq",
		default: false,
		tag: "tag:yaml.org,2002:pairs",
		resolve: resolvePairs,
		createNode: createPairs
	};
	exports.createPairs = createPairs;
	exports.pairs = pairs;
	exports.resolvePairs = resolvePairs;
}));
// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var toJS = require_toJS();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var pairs = require_pairs();
	var YAMLOMap = class YAMLOMap extends YAMLSeq.YAMLSeq {
		constructor() {
			super();
			this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
			this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
			this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
			this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
			this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
			this.tag = YAMLOMap.tag;
		}
		/**
		* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
		* but TypeScript won't allow widening the signature of a child method.
		*/
		toJSON(_, ctx) {
			if (!ctx) return super.toJSON(_);
			const map = /* @__PURE__ */ new Map();
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const pair of this.items) {
				let key, value;
				if (identity.isPair(pair)) {
					key = toJS.toJS(pair.key, "", ctx);
					value = toJS.toJS(pair.value, key, ctx);
				} else key = toJS.toJS(pair, "", ctx);
				if (map.has(key)) throw new Error("Ordered maps must not include duplicate keys");
				map.set(key, value);
			}
			return map;
		}
		static from(schema, iterable, ctx) {
			const pairs$1 = pairs.createPairs(schema, iterable, ctx);
			const omap = new this();
			omap.items = pairs$1.items;
			return omap;
		}
	};
	YAMLOMap.tag = "tag:yaml.org,2002:omap";
	var omap = {
		collection: "seq",
		identify: (value) => value instanceof Map,
		nodeClass: YAMLOMap,
		default: false,
		tag: "tag:yaml.org,2002:omap",
		resolve(seq, onError) {
			const pairs$1 = pairs.resolvePairs(seq, onError);
			const seenKeys = [];
			for (const { key } of pairs$1.items) if (identity.isScalar(key)) {
				if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
				else seenKeys.push(key.value);
			}
			return Object.assign(new YAMLOMap(), pairs$1);
		},
		createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
	};
	exports.YAMLOMap = YAMLOMap;
	exports.omap = omap;
}));
// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function boolStringify({ value, source }, ctx) {
		if (source && (value ? trueTag : falseTag).test.test(source)) return source;
		return value ? ctx.options.trueStr : ctx.options.falseStr;
	}
	var trueTag = {
		identify: (value) => value === true,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
		resolve: () => new Scalar.Scalar(true),
		stringify: boolStringify
	};
	var falseTag = {
		identify: (value) => value === false,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
		resolve: () => new Scalar.Scalar(false),
		stringify: boolStringify
	};
	exports.falseTag = falseTag;
	exports.trueTag = trueTag;
}));
// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	var floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	var floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str.replace(/_/g, "")),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	exports.float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
			const dot = str.indexOf(".");
			if (dot !== -1) {
				const f = str.substring(dot + 1).replace(/_/g, "");
				if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
			}
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));
// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	function intResolve(str, offset, radix, { intAsBigInt }) {
		const sign = str[0];
		if (sign === "-" || sign === "+") offset += 1;
		str = str.substring(offset).replace(/_/g, "");
		if (intAsBigInt) {
			switch (radix) {
				case 2:
					str = `0b${str}`;
					break;
				case 8:
					str = `0o${str}`;
					break;
				case 16: str = `0x${str}`;
			}
			const n = BigInt(str);
			return sign === "-" ? BigInt(-1) * n : n;
		}
		const n = parseInt(str, radix);
		return sign === "-" ? -1 * n : n;
	}
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value)) {
			const str = value.toString(radix);
			return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
		}
		return stringifyNumber.stringifyNumber(node);
	}
	var intBin = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "BIN",
		test: /^[-+]?0b[0-1_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
		stringify: (node) => intStringify(node, 2, "0b")
	};
	var intOct = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^[-+]?0[0-7_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
		stringify: (node) => intStringify(node, 8, "0")
	};
	var int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9][0-9_]*$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	var intHex = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^[-+]?0x[0-9a-fA-F_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intBin = intBin;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));
// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSet = class YAMLSet extends YAMLMap.YAMLMap {
		constructor(schema) {
			super(schema);
			this.tag = YAMLSet.tag;
		}
		add(key) {
			let pair;
			if (identity.isPair(key)) pair = key;
			else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair.Pair(key.key, null);
			else pair = new Pair.Pair(key, null);
			if (!YAMLMap.findPair(this.items, pair.key)) this.items.push(pair);
		}
		/**
		* If `keepPair` is `true`, returns the Pair matching `key`.
		* Otherwise, returns the value of that Pair's key.
		*/
		get(key, keepPair) {
			const pair = YAMLMap.findPair(this.items, key);
			return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
		}
		set(key, value) {
			if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
			const prev = YAMLMap.findPair(this.items, key);
			if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
			else if (!prev && value) this.items.push(new Pair.Pair(key));
		}
		toJSON(_, ctx) {
			return super.toJSON(_, ctx, Set);
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
			else throw new Error("Set items must all have null values");
		}
		static from(schema, iterable, ctx) {
			const { replacer } = ctx;
			const set = new this(schema);
			if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
				if (typeof replacer === "function") value = replacer.call(iterable, value, value);
				set.items.push(Pair.createPair(value, null, ctx));
			}
			return set;
		}
	};
	YAMLSet.tag = "tag:yaml.org,2002:set";
	var set = {
		collection: "map",
		identify: (value) => value instanceof Set,
		nodeClass: YAMLSet,
		default: false,
		tag: "tag:yaml.org,2002:set",
		createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
		resolve(map, onError) {
			if (identity.isMap(map)) {
				if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
				else onError("Set items must all have null values");
			} else onError("Expected a mapping for this tag");
			return map;
		}
	};
	exports.YAMLSet = YAMLSet;
	exports.set = set;
}));
// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	/** Internal types handle bigint as number, because TS can't figure it out. */
	function parseSexagesimal(str, asBigInt) {
		const sign = str[0];
		const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
		const num = (n) => asBigInt ? BigInt(n) : Number(n);
		const res = parts.replace(/_/g, "").split(":").reduce((res, p) => res * num(60) + num(p), num(0));
		return sign === "-" ? num(-1) * res : res;
	}
	/**
	* hhhh:mm:ss.sss
	*
	* Internal types handle bigint as number, because TS can't figure it out.
	*/
	function stringifySexagesimal(node) {
		let { value } = node;
		let num = (n) => n;
		if (typeof value === "bigint") num = (n) => BigInt(n);
		else if (isNaN(value) || !isFinite(value)) return stringifyNumber.stringifyNumber(node);
		let sign = "";
		if (value < 0) {
			sign = "-";
			value *= num(-1);
		}
		const _60 = num(60);
		const parts = [value % _60];
		if (value < 60) parts.unshift(0);
		else {
			value = (value - parts[0]) / _60;
			parts.unshift(value % _60);
			if (value >= 60) {
				value = (value - parts[0]) / _60;
				parts.unshift(value);
			}
		}
		return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
	}
	var intTime = {
		identify: (value) => typeof value === "bigint" || Number.isInteger(value),
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
		resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
		stringify: stringifySexagesimal
	};
	var floatTime = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
		resolve: (str) => parseSexagesimal(str, false),
		stringify: stringifySexagesimal
	};
	var timestamp = {
		identify: (value) => value instanceof Date,
		default: true,
		tag: "tag:yaml.org,2002:timestamp",
		test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
		resolve(str) {
			const match = str.match(timestamp.test);
			if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
			const [, year, month, day, hour, minute, second] = match.map(Number);
			const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
			let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
			const tz = match[8];
			if (tz && tz !== "Z") {
				let d = parseSexagesimal(tz, false);
				if (Math.abs(d) < 30) d *= 60;
				date -= 6e4 * d;
			}
			return new Date(date);
		},
		stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
	};
	exports.floatTime = floatTime;
	exports.intTime = intTime;
	exports.timestamp = timestamp;
}));
// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var binary = require_binary();
	var bool = require_bool();
	var float = require_float();
	var int = require_int();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var set = require_set();
	var timestamp = require_timestamp();
	exports.schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.trueTag,
		bool.falseTag,
		int.intBin,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float,
		binary.binary,
		merge.merge,
		omap.omap,
		pairs.pairs,
		set.set,
		timestamp.intTime,
		timestamp.floatTime,
		timestamp.timestamp
	];
}));
// node_modules/yaml/dist/schema/tags.js
var require_tags = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	var schema = require_schema$2();
	var schema$1 = require_schema$1();
	var binary = require_binary();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var schema$2 = require_schema();
	var set = require_set();
	var timestamp = require_timestamp();
	var schemas = /* @__PURE__ */ new Map([
		["core", schema.schema],
		["failsafe", [
			map.map,
			seq.seq,
			string.string
		]],
		["json", schema$1.schema],
		["yaml11", schema$2.schema],
		["yaml-1.1", schema$2.schema]
	]);
	var tagsByName = {
		binary: binary.binary,
		bool: bool.boolTag,
		float: float.float,
		floatExp: float.floatExp,
		floatNaN: float.floatNaN,
		floatTime: timestamp.floatTime,
		int: int.int,
		intHex: int.intHex,
		intOct: int.intOct,
		intTime: timestamp.intTime,
		map: map.map,
		merge: merge.merge,
		null: _null.nullTag,
		omap: omap.omap,
		pairs: pairs.pairs,
		seq: seq.seq,
		set: set.set,
		timestamp: timestamp.timestamp
	};
	var coreKnownTags = {
		"tag:yaml.org,2002:binary": binary.binary,
		"tag:yaml.org,2002:merge": merge.merge,
		"tag:yaml.org,2002:omap": omap.omap,
		"tag:yaml.org,2002:pairs": pairs.pairs,
		"tag:yaml.org,2002:set": set.set,
		"tag:yaml.org,2002:timestamp": timestamp.timestamp
	};
	function getTags(customTags, schemaName, addMergeTag) {
		const schemaTags = schemas.get(schemaName);
		if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
		let tags = schemaTags;
		if (!tags) {
			if (Array.isArray(customTags)) tags = [];
			else {
				const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
			}
		}
		if (Array.isArray(customTags)) for (const tag of customTags) tags = tags.concat(tag);
		else if (typeof customTags === "function") tags = customTags(tags.slice());
		if (addMergeTag) tags = tags.concat(merge.merge);
		return tags.reduce((tags, tag) => {
			const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
			if (!tagObj) {
				const tagName = JSON.stringify(tag);
				const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
			}
			if (!tags.includes(tagObj)) tags.push(tagObj);
			return tags;
		}, []);
	}
	exports.coreKnownTags = coreKnownTags;
	exports.getTags = getTags;
}));
// node_modules/yaml/dist/schema/Schema.js
var require_Schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var map = require_map();
	var seq = require_seq();
	var string = require_string();
	var tags = require_tags();
	var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	exports.Schema = class Schema {
		constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
			this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
			this.name = typeof schema === "string" && schema || "core";
			this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
			this.tags = tags.getTags(customTags, this.name, merge);
			this.toStringOptions = toStringDefaults ?? null;
			Object.defineProperty(this, identity.MAP, { value: map.map });
			Object.defineProperty(this, identity.SCALAR, { value: string.string });
			Object.defineProperty(this, identity.SEQ, { value: seq.seq });
			this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
		}
		clone() {
			const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
			copy.tags = this.tags.slice();
			return copy;
		}
	};
}));
// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyDocument(doc, options) {
		const lines = [];
		let hasDirectives = options.directives === true;
		if (options.directives !== false && doc.directives) {
			const dir = doc.directives.toString(doc);
			if (dir) {
				lines.push(dir);
				hasDirectives = true;
			} else if (doc.directives.docStart) hasDirectives = true;
		}
		if (hasDirectives) lines.push("---");
		const ctx = stringify.createStringifyContext(doc, options);
		const { commentString } = ctx.options;
		if (doc.commentBefore) {
			if (lines.length !== 1) lines.unshift("");
			const cs = commentString(doc.commentBefore);
			lines.unshift(stringifyComment.indentComment(cs, ""));
		}
		let chompKeep = false;
		let contentComment = null;
		if (doc.contents) {
			if (identity.isNode(doc.contents)) {
				if (doc.contents.spaceBefore && hasDirectives) lines.push("");
				if (doc.contents.commentBefore) {
					const cs = commentString(doc.contents.commentBefore);
					lines.push(stringifyComment.indentComment(cs, ""));
				}
				ctx.forceBlockIndent = !!doc.comment;
				contentComment = doc.contents.comment;
			}
			const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
			let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
			if (contentComment) body += stringifyComment.lineComment(body, "", commentString(contentComment));
			if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
			else lines.push(body);
		} else lines.push(stringify.stringify(doc.contents, ctx));
		if (doc.directives?.docEnd) {
			if (doc.comment) {
				const cs = commentString(doc.comment);
				if (cs.includes("\n")) {
					lines.push("...");
					lines.push(stringifyComment.indentComment(cs, ""));
				} else lines.push(`... ${cs}`);
			} else lines.push("...");
		} else {
			let dc = doc.comment;
			if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
			if (dc) {
				if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
				lines.push(stringifyComment.indentComment(commentString(dc), ""));
			}
		}
		return lines.join("\n") + "\n";
	}
	exports.stringifyDocument = stringifyDocument;
}));
// node_modules/yaml/dist/doc/Document.js
var require_Document = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var toJS = require_toJS();
	var Schema = require_Schema();
	var stringifyDocument = require_stringifyDocument();
	var anchors = require_anchors();
	var applyReviver = require_applyReviver();
	var createNode = require_createNode();
	var directives = require_directives();
	var Document = class Document {
		constructor(value, replacer, options) {
			/** A comment before this Document */
			this.commentBefore = null;
			/** A comment immediately after this Document */
			this.comment = null;
			/** Errors encountered during parsing. */
			this.errors = [];
			/** Warnings encountered during parsing. */
			this.warnings = [];
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
			let _replacer = null;
			if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
			else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const opt = Object.assign({
				intAsBigInt: false,
				keepSourceTokens: false,
				logLevel: "warn",
				prettyErrors: true,
				strict: true,
				stringKeys: false,
				uniqueKeys: true,
				version: "1.2"
			}, options);
			this.options = opt;
			let { version } = opt;
			if (options?._directives) {
				this.directives = options._directives.atDocument();
				if (this.directives.yaml.explicit) version = this.directives.yaml.version;
			} else this.directives = new directives.Directives({ version });
			this.setSchema(version, options);
			this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
		}
		/**
		* Create a deep copy of this Document and its contents.
		*
		* Custom Node values that inherit from `Object` still refer to their original instances.
		*/
		clone() {
			const copy = Object.create(Document.prototype, { [identity.NODE_TYPE]: { value: identity.DOC } });
			copy.commentBefore = this.commentBefore;
			copy.comment = this.comment;
			copy.errors = this.errors.slice();
			copy.warnings = this.warnings.slice();
			copy.options = Object.assign({}, this.options);
			if (this.directives) copy.directives = this.directives.clone();
			copy.schema = this.schema.clone();
			copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** Adds a value to the document. */
		add(value) {
			if (assertCollection(this.contents)) this.contents.add(value);
		}
		/** Adds a value to the document. */
		addIn(path, value) {
			if (assertCollection(this.contents)) this.contents.addIn(path, value);
		}
		/**
		* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
		*
		* If `node` already has an anchor, `name` is ignored.
		* Otherwise, the `node.anchor` value will be set to `name`,
		* or if an anchor with that name is already present in the document,
		* `name` will be used as a prefix for a new unique anchor.
		* If `name` is undefined, the generated anchor will use 'a' as a prefix.
		*/
		createAlias(node, name) {
			if (!node.anchor) {
				const prev = anchors.anchorNames(this);
				node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
			}
			return new Alias.Alias(node.anchor);
		}
		createNode(value, replacer, options) {
			let _replacer = void 0;
			if (typeof replacer === "function") {
				value = replacer.call({ "": value }, "", value);
				_replacer = replacer;
			} else if (Array.isArray(replacer)) {
				const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
				const asStr = replacer.filter(keyToStr).map(String);
				if (asStr.length > 0) replacer = replacer.concat(asStr);
				_replacer = replacer;
			} else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
			const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
			const ctx = {
				aliasDuplicateObjects: aliasDuplicateObjects ?? true,
				keepUndefined: keepUndefined ?? false,
				onAnchor,
				onTagObj,
				replacer: _replacer,
				schema: this.schema,
				sourceObjects
			};
			const node = createNode.createNode(value, tag, ctx);
			if (flow && identity.isCollection(node)) node.flow = true;
			setAnchors();
			return node;
		}
		/**
		* Convert a key and a value into a `Pair` using the current schema,
		* recursively wrapping all values as `Scalar` or `Collection` nodes.
		*/
		createPair(key, value, options = {}) {
			const k = this.createNode(key, null, options);
			const v = this.createNode(value, null, options);
			return new Pair.Pair(k, v);
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			return assertCollection(this.contents) ? this.contents.delete(key) : false;
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			if (Collection.isEmptyPath(path)) {
				if (this.contents == null) return false;
				this.contents = null;
				return true;
			}
			return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		get(key, keepScalar) {
			return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
		}
		/**
		* Returns item at `path`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			if (Collection.isEmptyPath(path)) return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
			return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
		}
		/**
		* Checks if the document includes a value with the key `key`.
		*/
		has(key) {
			return identity.isCollection(this.contents) ? this.contents.has(key) : false;
		}
		/**
		* Checks if the document includes a value at `path`.
		*/
		hasIn(path) {
			if (Collection.isEmptyPath(path)) return this.contents !== void 0;
			return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		set(key, value) {
			if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, [key], value);
			else if (assertCollection(this.contents)) this.contents.set(key, value);
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			if (Collection.isEmptyPath(path)) this.contents = value;
			else if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
			else if (assertCollection(this.contents)) this.contents.setIn(path, value);
		}
		/**
		* Change the YAML version and schema used by the document.
		* A `null` version disables support for directives, explicit tags, anchors, and aliases.
		* It also requires the `schema` option to be given as a `Schema` instance value.
		*
		* Overrides all previously set schema options.
		*/
		setSchema(version, options = {}) {
			if (typeof version === "number") version = String(version);
			let opt;
			switch (version) {
				case "1.1":
					if (this.directives) this.directives.yaml.version = "1.1";
					else this.directives = new directives.Directives({ version: "1.1" });
					opt = {
						resolveKnownTags: false,
						schema: "yaml-1.1"
					};
					break;
				case "1.2":
				case "next":
					if (this.directives) this.directives.yaml.version = version;
					else this.directives = new directives.Directives({ version });
					opt = {
						resolveKnownTags: true,
						schema: "core"
					};
					break;
				case null:
					if (this.directives) delete this.directives;
					opt = null;
					break;
				default: {
					const sv = JSON.stringify(version);
					throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
				}
			}
			if (options.schema instanceof Object) this.schema = options.schema;
			else if (opt) this.schema = new Schema.Schema(Object.assign(opt, options));
			else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
		}
		toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc: this,
				keep: !json,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
		/**
		* A JSON representation of the document `contents`.
		*
		* @param jsonArg Used by `JSON.stringify` to indicate the array index or
		*   property name.
		*/
		toJSON(jsonArg, onAnchor) {
			return this.toJS({
				json: true,
				jsonArg,
				mapAsMap: false,
				onAnchor
			});
		}
		/** A YAML representation of the document. */
		toString(options = {}) {
			if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
			if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
				const s = JSON.stringify(options.indent);
				throw new Error(`"indent" option must be a positive integer, not ${s}`);
			}
			return stringifyDocument.stringifyDocument(this, options);
		}
	};
	function assertCollection(contents) {
		if (identity.isCollection(contents)) return true;
		throw new Error("Expected a YAML collection as document contents");
	}
	exports.Document = Document;
}));
// node_modules/yaml/dist/errors.js
var require_errors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLError = class extends Error {
		constructor(name, pos, code, message) {
			super();
			this.name = name;
			this.code = code;
			this.message = message;
			this.pos = pos;
		}
	};
	var YAMLParseError = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLParseError", pos, code, message);
		}
	};
	var YAMLWarning = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLWarning", pos, code, message);
		}
	};
	var prettifyError = (src, lc) => (error) => {
		if (error.pos[0] === -1) return;
		error.linePos = error.pos.map((pos) => lc.linePos(pos));
		const { line, col } = error.linePos[0];
		error.message += ` at line ${line}, column ${col}`;
		let ci = col - 1;
		let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
		if (ci >= 60 && lineStr.length > 80) {
			const trimStart = Math.min(ci - 39, lineStr.length - 79);
			lineStr = "…" + lineStr.substring(trimStart);
			ci -= trimStart - 1;
		}
		if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
		if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
			let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
			if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
			lineStr = prev + lineStr;
		}
		if (/[^ ]/.test(lineStr)) {
			let count = 1;
			const end = error.linePos[1];
			if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
			const pointer = " ".repeat(ci) + "^".repeat(count);
			error.message += `:\n\n${lineStr}\n${pointer}\n`;
		}
	};
	exports.YAMLError = YAMLError;
	exports.YAMLParseError = YAMLParseError;
	exports.YAMLWarning = YAMLWarning;
	exports.prettifyError = prettifyError;
}));
// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
		let spaceBefore = false;
		let atNewline = startOnNewline;
		let hasSpace = startOnNewline;
		let comment = "";
		let commentSep = "";
		let hasNewline = false;
		let reqSpace = false;
		let tab = null;
		let anchor = null;
		let tag = null;
		let newlineAfterProp = null;
		let comma = null;
		let found = null;
		let start = null;
		for (const token of tokens) {
			if (reqSpace) {
				if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
				reqSpace = false;
			}
			if (tab) {
				if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
				tab = null;
			}
			switch (token.type) {
				case "space":
					if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
					hasSpace = true;
					break;
				case "comment": {
					if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					const cb = token.source.substring(1) || " ";
					if (!comment) comment = cb;
					else comment += commentSep + cb;
					commentSep = "";
					atNewline = false;
					break;
				}
				case "newline":
					if (atNewline) {
						if (comment) comment += token.source;
						else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
					} else commentSep += token.source;
					atNewline = true;
					hasNewline = true;
					if (anchor || tag) newlineAfterProp = token;
					hasSpace = true;
					break;
				case "anchor":
					if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
					if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
					anchor = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case "tag":
					if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
					tag = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case indicator:
					if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
					if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
					found = token;
					atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
					hasSpace = false;
					break;
				case "comma": if (flow) {
					if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
					comma = token;
					atNewline = false;
					hasSpace = false;
					break;
				}
				default:
					onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
					atNewline = false;
					hasSpace = false;
			}
		}
		const last = tokens[tokens.length - 1];
		const end = last ? last.offset + last.source.length : offset;
		if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
		if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
		return {
			comma,
			found,
			spaceBefore,
			comment,
			hasNewline,
			anchor,
			tag,
			newlineAfterProp,
			end,
			start: start ?? end
		};
	}
	exports.resolveProps = resolveProps;
}));
// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = /* @__PURE__ */ __commonJSMin(((exports) => {
	function containsNewline(key) {
		if (!key) return null;
		switch (key.type) {
			case "alias":
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				if (key.source.includes("\n")) return true;
				if (key.end) {
					for (const st of key.end) if (st.type === "newline") return true;
				}
				return false;
			case "flow-collection":
				for (const it of key.items) {
					for (const st of it.start) if (st.type === "newline") return true;
					if (it.sep) {
						for (const st of it.sep) if (st.type === "newline") return true;
					}
					if (containsNewline(it.key) || containsNewline(it.value)) return true;
				}
				return false;
			default: return true;
		}
	}
	exports.containsNewline = containsNewline;
}));
// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utilContainsNewline = require_util_contains_newline();
	function flowIndentCheck(indent, fc, onError) {
		if (fc?.type === "flow-collection") {
			const end = fc.end[0];
			if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
		}
	}
	exports.flowIndentCheck = flowIndentCheck;
}));
// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	function mapIncludes(ctx, items, search) {
		const { uniqueKeys } = ctx.options;
		if (uniqueKeys === false) return false;
		const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
		return items.some((pair) => isEqual(pair.key, search));
	}
	exports.mapIncludes = mapIncludes;
}));
// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	var utilMapIncludes = require_util_map_includes();
	var startColMsg = "All mapping items must start at the same column";
	function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
		const map = new ((tag?.nodeClass) ?? YAMLMap.YAMLMap)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		let offset = bm.offset;
		let commentEnd = null;
		for (const collItem of bm.items) {
			const { start, key, sep, value } = collItem;
			const keyProps = resolveProps.resolveProps(start, {
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: bm.indent,
				startOnNewline: true
			});
			const implicitKey = !keyProps.found;
			if (implicitKey) {
				if (key) {
					if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
					else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
				}
				if (!keyProps.anchor && !keyProps.tag && !sep) {
					commentEnd = keyProps.end;
					if (keyProps.comment) {
						if (map.comment) map.comment += "\n" + keyProps.comment;
						else map.comment = keyProps.comment;
					}
					continue;
				}
				if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
			} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
			ctx.atKey = true;
			const keyStart = keyProps.end;
			const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
			ctx.atKey = false;
			if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
			const valueProps = resolveProps.resolveProps(sep ?? [], {
				indicator: "map-value-ind",
				next: value,
				offset: keyNode.range[2],
				onError,
				parentIndent: bm.indent,
				startOnNewline: !key || key.type === "block-scalar"
			});
			offset = valueProps.end;
			if (valueProps.found) {
				if (implicitKey) {
					if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
					if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
				if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
				offset = valueNode.range[2];
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			} else {
				if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
				if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			}
		}
		if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
		map.range = [
			bm.offset,
			offset,
			commentEnd ?? offset
		];
		return map;
	}
	exports.resolveBlockMap = resolveBlockMap;
}));
// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLSeq = require_YAMLSeq();
	var resolveProps = require_resolve_props();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
		const seq = new ((tag?.nodeClass) ?? YAMLSeq.YAMLSeq)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = bs.offset;
		let commentEnd = null;
		for (const { start, value } of bs.items) {
			const props = resolveProps.resolveProps(start, {
				indicator: "seq-item-ind",
				next: value,
				offset,
				onError,
				parentIndent: bs.indent,
				startOnNewline: true
			});
			if (!props.found) {
				if (props.anchor || props.tag || value) {
					if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
					else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
				} else {
					commentEnd = props.end;
					if (props.comment) seq.comment = props.comment;
					continue;
				}
			}
			const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
			offset = node.range[2];
			seq.items.push(node);
		}
		seq.range = [
			bs.offset,
			offset,
			commentEnd ?? offset
		];
		return seq;
	}
	exports.resolveBlockSeq = resolveBlockSeq;
}));
// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveEnd(end, offset, reqSpace, onError) {
		let comment = "";
		if (end) {
			let hasSpace = false;
			let sep = "";
			for (const token of end) {
				const { source, type } = token;
				switch (type) {
					case "space":
						hasSpace = true;
						break;
					case "comment": {
						if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						const cb = source.substring(1) || " ";
						if (!comment) comment = cb;
						else comment += sep + cb;
						sep = "";
						break;
					}
					case "newline":
						if (comment) sep += source;
						hasSpace = true;
						break;
					default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
				}
				offset += source.length;
			}
		}
		return {
			comment,
			offset
		};
	}
	exports.resolveEnd = resolveEnd;
}));
// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilMapIncludes = require_util_map_includes();
	var blockMsg = "Block collections are not allowed within flow collections";
	var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
	function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
		const isMap = fc.start.source === "{";
		const fcName = isMap ? "flow map" : "flow sequence";
		const coll = new ((tag?.nodeClass) ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq))(ctx.schema);
		coll.flow = true;
		const atRoot = ctx.atRoot;
		if (atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = fc.offset + fc.start.source.length;
		for (let i = 0; i < fc.items.length; ++i) {
			const collItem = fc.items[i];
			const { start, key, sep, value } = collItem;
			const props = resolveProps.resolveProps(start, {
				flow: fcName,
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: fc.indent,
				startOnNewline: false
			});
			if (!props.found) {
				if (!props.anchor && !props.tag && !sep && !value) {
					if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
					else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
					if (props.comment) {
						if (coll.comment) coll.comment += "\n" + props.comment;
						else coll.comment = props.comment;
					}
					offset = props.end;
					continue;
				}
				if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
			}
			if (i === 0) {
				if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
			} else {
				if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
				if (props.comment) {
					let prevItemComment = "";
					loop: for (const st of start) switch (st.type) {
						case "comma":
						case "space": break;
						case "comment":
							prevItemComment = st.source.substring(1);
							break loop;
						default: break loop;
					}
					if (prevItemComment) {
						let prev = coll.items[coll.items.length - 1];
						if (identity.isPair(prev)) prev = prev.value ?? prev.key;
						if (prev.comment) prev.comment += "\n" + prevItemComment;
						else prev.comment = prevItemComment;
						props.comment = props.comment.substring(prevItemComment.length + 1);
					}
				}
			}
			if (!isMap && !sep && !props.found) {
				const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
				coll.items.push(valueNode);
				offset = valueNode.range[2];
				if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
			} else {
				ctx.atKey = true;
				const keyStart = props.end;
				const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
				if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
				ctx.atKey = false;
				const valueProps = resolveProps.resolveProps(sep ?? [], {
					flow: fcName,
					indicator: "map-value-ind",
					next: value,
					offset: keyNode.range[2],
					onError,
					parentIndent: fc.indent,
					startOnNewline: false
				});
				if (valueProps.found) {
					if (!isMap && !props.found && ctx.options.strict) {
						if (sep) for (const st of sep) {
							if (st === valueProps.found) break;
							if (st.type === "newline") {
								onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
								break;
							}
						}
						if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
					}
				} else if (value) {
					if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
					else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
				if (valueNode) {
					if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
				} else if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				if (isMap) {
					const map = coll;
					if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
					map.items.push(pair);
				} else {
					const map = new YAMLMap.YAMLMap(ctx.schema);
					map.flow = true;
					map.items.push(pair);
					const endRange = (valueNode ?? keyNode).range;
					map.range = [
						keyNode.range[0],
						endRange[1],
						endRange[2]
					];
					coll.items.push(map);
				}
				offset = valueNode ? valueNode.range[2] : valueProps.end;
			}
		}
		const expectedEnd = isMap ? "}" : "]";
		const [ce, ...ee] = fc.end;
		let cePos = offset;
		if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
		else {
			const name = fcName[0].toUpperCase() + fcName.substring(1);
			const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
			onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
			if (ce && ce.source.length !== 1) ee.unshift(ce);
		}
		if (ee.length > 0) {
			const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
			if (end.comment) {
				if (coll.comment) coll.comment += "\n" + end.comment;
				else coll.comment = end.comment;
			}
			coll.range = [
				fc.offset,
				cePos,
				end.offset
			];
		} else coll.range = [
			fc.offset,
			cePos,
			cePos
		];
		return coll;
	}
	exports.resolveFlowCollection = resolveFlowCollection;
}));
// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveBlockMap = require_resolve_block_map();
	var resolveBlockSeq = require_resolve_block_seq();
	var resolveFlowCollection = require_resolve_flow_collection();
	function resolveCollection(CN, ctx, token, onError, tagName, tag) {
		const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
		const Coll = coll.constructor;
		if (tagName === "!" || tagName === Coll.tagName) {
			coll.tag = Coll.tagName;
			return coll;
		}
		if (tagName) coll.tag = tagName;
		return coll;
	}
	function composeCollection(CN, ctx, token, props, onError) {
		const tagToken = props.tag;
		const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
		if (token.type === "block-seq") {
			const { anchor, newlineAfterProp: nl } = props;
			const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
			if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
		}
		const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
		if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") return resolveCollection(CN, ctx, token, onError, tagName);
		let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
		if (!tag) {
			const kt = ctx.schema.knownTags[tagName];
			if (kt?.collection === expType) {
				ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
				tag = kt;
			} else {
				if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
				else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
				return resolveCollection(CN, ctx, token, onError, tagName);
			}
		}
		const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
		const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
		const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
		node.range = coll.range;
		node.tag = tagName;
		if (tag?.format) node.format = tag.format;
		return node;
	}
	exports.composeCollection = composeCollection;
}));
// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function resolveBlockScalar(ctx, scalar, onError) {
		const start = scalar.offset;
		const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
		if (!header) return {
			value: "",
			type: null,
			comment: "",
			range: [
				start,
				start,
				start
			]
		};
		const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
		const lines = scalar.source ? splitLines(scalar.source) : [];
		let chompStart = lines.length;
		for (let i = lines.length - 1; i >= 0; --i) {
			const content = lines[i][1];
			if (content === "" || content === "\r") chompStart = i;
			else break;
		}
		if (chompStart === 0) {
			const value = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
			let end = start + header.length;
			if (scalar.source) end += scalar.source.length;
			return {
				value,
				type,
				comment: header.comment,
				range: [
					start,
					end,
					end
				]
			};
		}
		let trimIndent = scalar.indent + header.indent;
		let offset = scalar.offset + header.length;
		let contentStart = 0;
		for (let i = 0; i < chompStart; ++i) {
			const [indent, content] = lines[i];
			if (content === "" || content === "\r") {
				if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
			} else {
				if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
				if (header.indent === 0) trimIndent = indent.length;
				contentStart = i;
				if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
				break;
			}
			offset += indent.length + content.length + 1;
		}
		for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
		let value = "";
		let sep = "";
		let prevMoreIndented = false;
		for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
		for (let i = contentStart; i < chompStart; ++i) {
			let [indent, content] = lines[i];
			offset += indent.length + content.length + 1;
			const crlf = content[content.length - 1] === "\r";
			if (crlf) content = content.slice(0, -1);
			/* istanbul ignore if already caught in lexer */
			if (content && indent.length < trimIndent) {
				const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
				onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
				indent = "";
			}
			if (type === Scalar.Scalar.BLOCK_LITERAL) {
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
			} else if (indent.length > trimIndent || content[0] === "	") {
				if (sep === " ") sep = "\n";
				else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
				prevMoreIndented = true;
			} else if (content === "") {
				if (sep === "\n") value += "\n";
				else sep = "\n";
			} else {
				value += sep + content;
				sep = " ";
				prevMoreIndented = false;
			}
		}
		switch (header.chomp) {
			case "-": break;
			case "+":
				for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
				if (value[value.length - 1] !== "\n") value += "\n";
				break;
			default: value += "\n";
		}
		const end = start + header.length + scalar.source.length;
		return {
			value,
			type,
			comment: header.comment,
			range: [
				start,
				end,
				end
			]
		};
	}
	function parseBlockScalarHeader({ offset, props }, strict, onError) {
		/* istanbul ignore if should not happen */
		if (props[0].type !== "block-scalar-header") {
			onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
			return null;
		}
		const { source } = props[0];
		const mode = source[0];
		let indent = 0;
		let chomp = "";
		let error = -1;
		for (let i = 1; i < source.length; ++i) {
			const ch = source[i];
			if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
			else {
				const n = Number(ch);
				if (!indent && n) indent = n;
				else if (error === -1) error = offset + i;
			}
		}
		if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
		let hasSpace = false;
		let comment = "";
		let length = source.length;
		for (let i = 1; i < props.length; ++i) {
			const token = props[i];
			switch (token.type) {
				case "space": hasSpace = true;
				case "newline":
					length += token.source.length;
					break;
				case "comment":
					if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					length += token.source.length;
					comment = token.source.substring(1);
					break;
				case "error":
					onError(token, "UNEXPECTED_TOKEN", token.message);
					length += token.source.length;
					break;
				/* istanbul ignore next should not happen */
				default: {
					onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
					const ts = token.source;
					if (ts && typeof ts === "string") length += ts.length;
				}
			}
		}
		return {
			mode,
			indent,
			chomp,
			comment,
			length
		};
	}
	/** @returns Array of lines split up as `[indent, content]` */
	function splitLines(source) {
		const split = source.split(/\n( *)/);
		const first = split[0];
		const m = first.match(/^( *)/);
		const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
		for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
		return lines;
	}
	exports.resolveBlockScalar = resolveBlockScalar;
}));
// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var resolveEnd = require_resolve_end();
	function resolveFlowScalar(scalar, strict, onError) {
		const { offset, type, source, end } = scalar;
		let _type;
		let value;
		const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
		switch (type) {
			case "scalar":
				_type = Scalar.Scalar.PLAIN;
				value = plainValue(source, _onError);
				break;
			case "single-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_SINGLE;
				value = singleQuotedValue(source, _onError);
				break;
			case "double-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_DOUBLE;
				value = doubleQuotedValue(source, _onError);
				break;
			/* istanbul ignore next should not happen */
			default:
				onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
				return {
					value: "",
					type: null,
					comment: "",
					range: [
						offset,
						offset + source.length,
						offset + source.length
					]
				};
		}
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
		return {
			value,
			type: _type,
			comment: re.comment,
			range: [
				offset,
				valueEnd,
				re.offset
			]
		};
	}
	function plainValue(source, onError) {
		let badChar = "";
		switch (source[0]) {
			/* istanbul ignore next should not happen */
			case "	":
				badChar = "a tab character";
				break;
			case ",":
				badChar = "flow indicator character ,";
				break;
			case "%":
				badChar = "directive indicator character %";
				break;
			case "|":
			case ">":
				badChar = `block scalar indicator ${source[0]}`;
				break;
			case "@":
			case "`": badChar = `reserved character ${source[0]}`;
		}
		if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
		return unfoldLines(source);
	}
	function singleQuotedValue(source, onError) {
		if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
		return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
	}
	function unfoldLines(source) {
		const line = /(.*?)\r?\n/sy;
		let match = line.exec(source);
		if (!match) return source;
		/**
		* The negative lookbehinds in these RegExps are to
		* prevent causing a polynomial search time in certain cases.
		*
		* The try-catch is for Safari < 16.4 and other old browsers:
		* https://caniuse.com/js-regexp-lookbehind
		*/
		let trimEnd, trimBoth;
		try {
			trimEnd = /* @__PURE__ */ new RegExp("(?<![ 	])[ 	]+$");
			trimBoth = /* @__PURE__ */ new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
		} catch {
			trimEnd = /[ \t]+$/;
			trimBoth = /^[ \t]+|[ \t]+$/g;
		}
		let res = match[1].replace(trimEnd, "");
		let sep = " ";
		let pos = line.lastIndex;
		while (match = line.exec(source)) {
			const lm = match[1].replace(trimBoth, "");
			if (lm === "") {
				if (sep === "\n") res += sep;
				else sep = "\n";
			} else {
				res += sep + lm;
				sep = " ";
			}
			pos = line.lastIndex;
		}
		const last = /[ \t]*(.*)/sy;
		last.lastIndex = pos;
		match = last.exec(source);
		return res + sep + (match?.[1] ?? "");
	}
	function doubleQuotedValue(source, onError) {
		let res = "";
		for (let i = 1; i < source.length - 1; ++i) {
			const ch = source[i];
			if (ch === "\r" && source[i + 1] === "\n") continue;
			if (ch === "\n") {
				const { fold, offset } = foldNewline(source, i);
				res += fold;
				i = offset;
			} else if (ch === "\\") {
				let next = source[++i];
				const cc = escapeCodes[next];
				if (cc) res += cc;
				else if (next === "\n") {
					next = source[i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "\r" && source[i + 1] === "\n") {
					next = source[++i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "x" || next === "u" || next === "U") {
					const length = next === "x" ? 2 : next === "u" ? 4 : 8;
					res += parseCharCode(source, i + 1, length, onError);
					i += length;
				} else {
					const raw = source.substr(i - 1, 2);
					onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
					res += raw;
				}
			} else if (ch === " " || ch === "	") {
				const wsStart = i;
				let next = source[i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
				if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
			} else res += ch;
		}
		if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
		return res;
	}
	/**
	* Fold a single newline into a space, multiple newlines to N - 1 newlines.
	* Presumes `source[offset] === '\n'`
	*/
	function foldNewline(source, offset) {
		let fold = "";
		let ch = source[offset + 1];
		while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
			if (ch === "\r" && source[offset + 2] !== "\n") break;
			if (ch === "\n") fold += "\n";
			offset += 1;
			ch = source[offset + 1];
		}
		if (!fold) fold = " ";
		return {
			fold,
			offset
		};
	}
	var escapeCodes = {
		"0": "\0",
		a: "\x07",
		b: "\b",
		e: "\x1B",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "	",
		v: "\v",
		N: "",
		_: "\xA0",
		L: "\u2028",
		P: "\u2029",
		" ": " ",
		"\"": "\"",
		"/": "/",
		"\\": "\\",
		"	": "	"
	};
	function parseCharCode(source, offset, length, onError) {
		const cc = source.substr(offset, length);
		const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
		try {
			return String.fromCodePoint(code);
		} catch {
			const raw = source.substr(offset - 2, length + 2);
			onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
			return raw;
		}
	}
	exports.resolveFlowScalar = resolveFlowScalar;
}));
// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	function composeScalar(ctx, token, tagToken, onError) {
		const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
		const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
		let tag;
		if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[identity.SCALAR];
		else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
		else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
		else tag = ctx.schema[identity.SCALAR];
		let scalar;
		try {
			const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
			scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
			scalar = new Scalar.Scalar(value);
		}
		scalar.range = range;
		scalar.source = value;
		if (type) scalar.type = type;
		if (tagName) scalar.tag = tagName;
		if (tag.format) scalar.format = tag.format;
		if (comment) scalar.comment = comment;
		return scalar;
	}
	function findScalarTagByName(schema, value, tagName, tagToken, onError) {
		if (tagName === "!") return schema[identity.SCALAR];
		const matchWithTest = [];
		for (const tag of schema.tags) if (!tag.collection && tag.tag === tagName) {
			if (tag.default && tag.test) matchWithTest.push(tag);
			else return tag;
		}
		for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
		const kt = schema.knownTags[tagName];
		if (kt && !kt.collection) {
			schema.tags.push(Object.assign({}, kt, {
				default: false,
				test: void 0
			}));
			return kt;
		}
		onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
		return schema[identity.SCALAR];
	}
	function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
		const tag = schema.tags.find((tag) => (tag.default === true || atKey && tag.default === "key") && tag.test?.test(value)) || schema[identity.SCALAR];
		if (schema.compat) {
			const compat = schema.compat.find((tag) => tag.default && tag.test?.test(value)) ?? schema[identity.SCALAR];
			if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives.tagString(tag.tag)} or ${directives.tagString(compat.tag)}`, true);
		}
		return tag;
	}
	exports.composeScalar = composeScalar;
}));
// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = /* @__PURE__ */ __commonJSMin(((exports) => {
	function emptyScalarPosition(offset, before, pos) {
		if (before) {
			pos ?? (pos = before.length);
			for (let i = pos - 1; i >= 0; --i) {
				let st = before[i];
				switch (st.type) {
					case "space":
					case "comment":
					case "newline":
						offset -= st.source.length;
						continue;
				}
				st = before[++i];
				while (st?.type === "space") {
					offset += st.source.length;
					st = before[++i];
				}
				break;
			}
		}
		return offset;
	}
	exports.emptyScalarPosition = emptyScalarPosition;
}));
// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var composeCollection = require_compose_collection();
	var composeScalar = require_compose_scalar();
	var resolveEnd = require_resolve_end();
	var utilEmptyScalarPosition = require_util_empty_scalar_position();
	var CN = {
		composeNode,
		composeEmptyNode
	};
	function composeNode(ctx, token, props, onError) {
		const atKey = ctx.atKey;
		const { spaceBefore, comment, anchor, tag } = props;
		let node;
		let isSrcToken = true;
		switch (token.type) {
			case "alias":
				node = composeAlias(ctx, token, onError);
				if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
				break;
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "block-scalar":
				node = composeScalar.composeScalar(ctx, token, tag, onError);
				if (anchor) node.anchor = anchor.source.substring(1);
				break;
			case "block-map":
			case "block-seq":
			case "flow-collection":
				try {
					node = composeCollection.composeCollection(CN, ctx, token, props, onError);
					if (anchor) node.anchor = anchor.source.substring(1);
				} catch (error) {
					onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
				}
				break;
			default:
				onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
				isSrcToken = false;
		}
		node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
		if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			if (token.type === "scalar" && token.source === "") node.comment = comment;
			else node.commentBefore = comment;
		}
		if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
		return node;
	}
	function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
		const token = {
			type: "scalar",
			offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
			indent: -1,
			source: ""
		};
		const node = composeScalar.composeScalar(ctx, token, tag, onError);
		if (anchor) {
			node.anchor = anchor.source.substring(1);
			if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		}
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			node.comment = comment;
			node.range[2] = end;
		}
		return node;
	}
	function composeAlias({ options }, { offset, source, end }, onError) {
		const alias = new Alias.Alias(source.substring(1));
		if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
		if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
		alias.range = [
			offset,
			valueEnd,
			re.offset
		];
		if (re.comment) alias.comment = re.comment;
		return alias;
	}
	exports.composeEmptyNode = composeEmptyNode;
	exports.composeNode = composeNode;
}));
// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Document = require_Document();
	var composeNode = require_compose_node();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	function composeDoc(options, directives, { offset, start, value, end }, onError) {
		const opts = Object.assign({ _directives: directives }, options);
		const doc = new Document.Document(void 0, opts);
		const ctx = {
			atKey: false,
			atRoot: true,
			directives: doc.directives,
			options: doc.options,
			schema: doc.schema
		};
		const props = resolveProps.resolveProps(start, {
			indicator: "doc-start",
			next: value ?? end?.[0],
			offset,
			onError,
			parentIndent: 0,
			startOnNewline: true
		});
		if (props.found) {
			doc.directives.docStart = true;
			if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
		}
		doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
		const contentEnd = doc.contents.range[2];
		const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
		if (re.comment) doc.comment = re.comment;
		doc.range = [
			offset,
			contentEnd,
			re.offset
		];
		return doc;
	}
	exports.composeDoc = composeDoc;
}));
// node_modules/yaml/dist/compose/composer.js
var require_composer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var directives = require_directives();
	var Document = require_Document();
	var errors = require_errors();
	var identity = require_identity();
	var composeDoc = require_compose_doc();
	var resolveEnd = require_resolve_end();
	function getErrorPos(src) {
		if (typeof src === "number") return [src, src + 1];
		if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
		const { offset, source } = src;
		return [offset, offset + (typeof source === "string" ? source.length : 1)];
	}
	function parsePrelude(prelude) {
		let comment = "";
		let atComment = false;
		let afterEmptyLine = false;
		for (let i = 0; i < prelude.length; ++i) {
			const source = prelude[i];
			switch (source[0]) {
				case "#":
					comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
					atComment = true;
					afterEmptyLine = false;
					break;
				case "%":
					if (prelude[i + 1]?.[0] !== "#") i += 1;
					atComment = false;
					break;
				default:
					if (!atComment) afterEmptyLine = true;
					atComment = false;
			}
		}
		return {
			comment,
			afterEmptyLine
		};
	}
	/**
	* Compose a stream of CST nodes into a stream of YAML Documents.
	*
	* ```ts
	* import { Composer, Parser } from 'yaml'
	*
	* const src: string = ...
	* const tokens = new Parser().parse(src)
	* const docs = new Composer().compose(tokens)
	* ```
	*/
	var Composer = class {
		constructor(options = {}) {
			this.doc = null;
			this.atDirectives = false;
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
			this.onError = (source, code, message, warning) => {
				const pos = getErrorPos(source);
				if (warning) this.warnings.push(new errors.YAMLWarning(pos, code, message));
				else this.errors.push(new errors.YAMLParseError(pos, code, message));
			};
			this.directives = new directives.Directives({ version: options.version || "1.2" });
			this.options = options;
		}
		decorate(doc, afterDoc) {
			const { comment, afterEmptyLine } = parsePrelude(this.prelude);
			if (comment) {
				const dc = doc.contents;
				if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
				else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
				else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
					let it = dc.items[0];
					if (identity.isPair(it)) it = it.key;
					const cb = it.commentBefore;
					it.commentBefore = cb ? `${comment}\n${cb}` : comment;
				} else {
					const cb = dc.commentBefore;
					dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
				}
			}
			if (afterDoc) {
				for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
				for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
			} else {
				doc.errors = this.errors;
				doc.warnings = this.warnings;
			}
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
		}
		/**
		* Current stream status information.
		*
		* Mostly useful at the end of input for an empty stream.
		*/
		streamInfo() {
			return {
				comment: parsePrelude(this.prelude).comment,
				directives: this.directives,
				errors: this.errors,
				warnings: this.warnings
			};
		}
		/**
		* Compose tokens into documents.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*compose(tokens, forceDoc = false, endOffset = -1) {
			for (const token of tokens) yield* this.next(token);
			yield* this.end(forceDoc, endOffset);
		}
		/** Advance the composer by one CST token. */
		*next(token) {
			if (node_process.env.LOG_STREAM) console.dir(token, { depth: null });
			switch (token.type) {
				case "directive":
					this.directives.add(token.source, (offset, message, warning) => {
						const pos = getErrorPos(token);
						pos[0] += offset;
						this.onError(pos, "BAD_DIRECTIVE", message, warning);
					});
					this.prelude.push(token.source);
					this.atDirectives = true;
					break;
				case "document": {
					const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
					if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
					this.decorate(doc, false);
					if (this.doc) yield this.doc;
					this.doc = doc;
					this.atDirectives = false;
					break;
				}
				case "byte-order-mark":
				case "space": break;
				case "comment":
				case "newline":
					this.prelude.push(token.source);
					break;
				case "error": {
					const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
					const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
					if (this.atDirectives || !this.doc) this.errors.push(error);
					else this.doc.errors.push(error);
					break;
				}
				case "doc-end": {
					if (!this.doc) {
						this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
						break;
					}
					this.doc.directives.docEnd = true;
					const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
					this.decorate(this.doc, true);
					if (end.comment) {
						const dc = this.doc.comment;
						this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
					}
					this.doc.range[2] = end.offset;
					break;
				}
				default: this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
			}
		}
		/**
		* Call at end of input to yield any remaining document.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*end(forceDoc = false, endOffset = -1) {
			if (this.doc) {
				this.decorate(this.doc, true);
				yield this.doc;
				this.doc = null;
			} else if (forceDoc) {
				const opts = Object.assign({ _directives: this.directives }, this.options);
				const doc = new Document.Document(void 0, opts);
				if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
				doc.range = [
					0,
					endOffset,
					endOffset
				];
				this.decorate(doc, false);
				yield doc;
			}
		}
	};
	exports.Composer = Composer;
}));
// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	var errors = require_errors();
	var stringifyString = require_stringifyString();
	function resolveAsScalar(token, strict = true, onError) {
		if (token) {
			const _onError = (pos, code, message) => {
				const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
				if (onError) onError(offset, code, message);
				else throw new errors.YAMLParseError([offset, offset + 1], code, message);
			};
			switch (token.type) {
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
				case "block-scalar": return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
			}
		}
		return null;
	}
	/**
	* Create a new scalar token with `value`
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.indent The indent level of the token.
	* @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
	* @param context.offset The offset position of the token.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function createScalarToken(value, context) {
		const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey,
			indent: indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		const end = context.end ?? [{
			type: "newline",
			offset: -1,
			indent,
			source: "\n"
		}];
		switch (source[0]) {
			case "|":
			case ">": {
				const he = source.indexOf("\n");
				const head = source.substring(0, he);
				const body = source.substring(he + 1) + "\n";
				const props = [{
					type: "block-scalar-header",
					offset,
					indent,
					source: head
				}];
				if (!addEndtoBlockProps(props, end)) props.push({
					type: "newline",
					offset: -1,
					indent,
					source: "\n"
				});
				return {
					type: "block-scalar",
					offset,
					indent,
					props,
					source: body
				};
			}
			case "\"": return {
				type: "double-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			case "'": return {
				type: "single-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			default: return {
				type: "scalar",
				offset,
				indent,
				source,
				end
			};
		}
	}
	/**
	* Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
	*
	* Best efforts are made to retain any comments previously associated with the `token`,
	* though all contents within a collection's `items` will be overwritten.
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.afterKey In most cases, values after a key should have an additional level of indentation.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function setScalarValue(token, value, context = {}) {
		let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
		let indent = "indent" in token ? token.indent : null;
		if (afterKey && typeof indent === "number") indent += 2;
		if (!type) switch (token.type) {
			case "single-quoted-scalar":
				type = "QUOTE_SINGLE";
				break;
			case "double-quoted-scalar":
				type = "QUOTE_DOUBLE";
				break;
			case "block-scalar": {
				const header = token.props[0];
				if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
				type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
				break;
			}
			default: type = "PLAIN";
		}
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey: implicitKey || indent === null,
			indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		switch (source[0]) {
			case "|":
			case ">":
				setBlockScalarValue(token, source);
				break;
			case "\"":
				setFlowScalarValue(token, source, "double-quoted-scalar");
				break;
			case "'":
				setFlowScalarValue(token, source, "single-quoted-scalar");
				break;
			default: setFlowScalarValue(token, source, "scalar");
		}
	}
	function setBlockScalarValue(token, source) {
		const he = source.indexOf("\n");
		const head = source.substring(0, he);
		const body = source.substring(he + 1) + "\n";
		if (token.type === "block-scalar") {
			const header = token.props[0];
			if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
			header.source = head;
			token.source = body;
		} else {
			const { offset } = token;
			const indent = "indent" in token ? token.indent : -1;
			const props = [{
				type: "block-scalar-header",
				offset,
				indent,
				source: head
			}];
			if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0)) props.push({
				type: "newline",
				offset: -1,
				indent,
				source: "\n"
			});
			for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
			Object.assign(token, {
				type: "block-scalar",
				indent,
				props,
				source: body
			});
		}
	}
	/** @returns `true` if last token is a newline */
	function addEndtoBlockProps(props, end) {
		if (end) for (const st of end) switch (st.type) {
			case "space":
			case "comment":
				props.push(st);
				break;
			case "newline":
				props.push(st);
				return true;
		}
		return false;
	}
	function setFlowScalarValue(token, source, type) {
		switch (token.type) {
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				token.type = type;
				token.source = source;
				break;
			case "block-scalar": {
				const end = token.props.slice(1);
				let oa = source.length;
				if (token.props[0].type === "block-scalar-header") oa -= token.props[0].source.length;
				for (const tok of end) tok.offset += oa;
				delete token.props;
				Object.assign(token, {
					type,
					source,
					end
				});
				break;
			}
			case "block-map":
			case "block-seq": {
				const nl = {
					type: "newline",
					offset: token.offset + source.length,
					indent: token.indent,
					source: "\n"
				};
				delete token.items;
				Object.assign(token, {
					type,
					source,
					end: [nl]
				});
				break;
			}
			default: {
				const indent = "indent" in token ? token.indent : -1;
				const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
				for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
				Object.assign(token, {
					type,
					indent,
					source,
					end
				});
			}
		}
	}
	exports.createScalarToken = createScalarToken;
	exports.resolveAsScalar = resolveAsScalar;
	exports.setScalarValue = setScalarValue;
}));
// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringify a CST document, token, or collection item
	*
	* Fair warning: This applies no validation whatsoever, and
	* simply concatenates the sources in their logical order.
	*/
	var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
	function stringifyToken(token) {
		switch (token.type) {
			case "block-scalar": {
				let res = "";
				for (const tok of token.props) res += stringifyToken(tok);
				return res + token.source;
			}
			case "block-map":
			case "block-seq": {
				let res = "";
				for (const item of token.items) res += stringifyItem(item);
				return res;
			}
			case "flow-collection": {
				let res = token.start.source;
				for (const item of token.items) res += stringifyItem(item);
				for (const st of token.end) res += st.source;
				return res;
			}
			case "document": {
				let res = stringifyItem(token);
				if (token.end) for (const st of token.end) res += st.source;
				return res;
			}
			default: {
				let res = token.source;
				if ("end" in token && token.end) for (const st of token.end) res += st.source;
				return res;
			}
		}
	}
	function stringifyItem({ start, key, sep, value }) {
		let res = "";
		for (const st of start) res += st.source;
		if (key) res += stringifyToken(key);
		if (sep) for (const st of sep) res += st.source;
		if (value) res += stringifyToken(value);
		return res;
	}
	exports.stringify = stringify;
}));
// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	var BREAK = Symbol("break visit");
	var SKIP = Symbol("skip children");
	var REMOVE = Symbol("remove item");
	/**
	* Apply a visitor to a CST document or item.
	*
	* Walks through the tree (depth-first) starting from the root, calling a
	* `visitor` function with two arguments when entering each item:
	*   - `item`: The current item, which included the following members:
	*     - `start: SourceToken[]` – Source tokens before the key or value,
	*       possibly including its anchor or tag.
	*     - `key?: Token | null` – Set for pair values. May then be `null`, if
	*       the key before the `:` separator is empty.
	*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
	*       which should include the `:` map value indicator if `value` is set.
	*     - `value?: Token` – The value of a sequence item, or of a map pair.
	*   - `path`: The steps from the root to the current node, as an array of
	*     `['key' | 'value', number]` tuples.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this token, continue with
	*      next sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current item, then continue with the next one
	*   - `number`: Set the index of the next step. This is useful especially if
	*     the index of the current token has changed.
	*   - `function`: Define the next visitor for this item. After the original
	*     visitor is called on item entry, next visitors are called after handling
	*     a non-empty `key` and when exiting the item.
	*/
	function visit(cst, visitor) {
		if ("type" in cst && cst.type === "document") cst = {
			start: cst.start,
			value: cst.value
		};
		_visit(Object.freeze([]), cst, visitor);
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current item */
	visit.SKIP = SKIP;
	/** Remove the current item */
	visit.REMOVE = REMOVE;
	/** Find the item at `path` from `cst` as the root */
	visit.itemAtPath = (cst, path) => {
		let item = cst;
		for (const [field, index] of path) {
			const tok = item?.[field];
			if (tok && "items" in tok) item = tok.items[index];
			else return void 0;
		}
		return item;
	};
	/**
	* Get the immediate parent collection of the item at `path` from `cst` as the root.
	*
	* Throws an error if the collection is not found, which should never happen if the item itself exists.
	*/
	visit.parentCollection = (cst, path) => {
		const parent = visit.itemAtPath(cst, path.slice(0, -1));
		const field = path[path.length - 1][0];
		const coll = parent?.[field];
		if (coll && "items" in coll) return coll;
		throw new Error("Parent collection not found");
	};
	function _visit(path, item, visitor) {
		let ctrl = visitor(item, path);
		if (typeof ctrl === "symbol") return ctrl;
		for (const field of ["key", "value"]) {
			const token = item[field];
			if (token && "items" in token) {
				for (let i = 0; i < token.items.length; ++i) {
					const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						token.items.splice(i, 1);
						i -= 1;
					}
				}
				if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
			}
		}
		return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
	}
	exports.visit = visit;
}));
// node_modules/yaml/dist/parse/cst.js
var require_cst = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cstScalar = require_cst_scalar();
	var cstStringify = require_cst_stringify();
	var cstVisit = require_cst_visit();
	/** The byte order mark */
	var BOM = "﻿";
	/** Start of doc-mode */
	var DOCUMENT = "";
	/** Unexpected end of flow-mode */
	var FLOW_END = "";
	/** Next token is a scalar value */
	var SCALAR = "";
	/** @returns `true` if `token` is a flow or block collection */
	var isCollection = (token) => !!token && "items" in token;
	/** @returns `true` if `token` is a flow or block scalar; not an alias */
	var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
	/* istanbul ignore next */
	/** Get a printable representation of a lexer token */
	function prettyToken(token) {
		switch (token) {
			case BOM: return "<BOM>";
			case DOCUMENT: return "<DOC>";
			case FLOW_END: return "<FLOW_END>";
			case SCALAR: return "<SCALAR>";
			default: return JSON.stringify(token);
		}
	}
	/** Identify the type of a lexer token. May return `null` for unknown tokens. */
	function tokenType(source) {
		switch (source) {
			case BOM: return "byte-order-mark";
			case DOCUMENT: return "doc-mode";
			case FLOW_END: return "flow-error-end";
			case SCALAR: return "scalar";
			case "---": return "doc-start";
			case "...": return "doc-end";
			case "":
			case "\n":
			case "\r\n": return "newline";
			case "-": return "seq-item-ind";
			case "?": return "explicit-key-ind";
			case ":": return "map-value-ind";
			case "{": return "flow-map-start";
			case "}": return "flow-map-end";
			case "[": return "flow-seq-start";
			case "]": return "flow-seq-end";
			case ",": return "comma";
		}
		switch (source[0]) {
			case " ":
			case "	": return "space";
			case "#": return "comment";
			case "%": return "directive-line";
			case "*": return "alias";
			case "&": return "anchor";
			case "!": return "tag";
			case "'": return "single-quoted-scalar";
			case "\"": return "double-quoted-scalar";
			case "|":
			case ">": return "block-scalar-header";
		}
		return null;
	}
	exports.createScalarToken = cstScalar.createScalarToken;
	exports.resolveAsScalar = cstScalar.resolveAsScalar;
	exports.setScalarValue = cstScalar.setScalarValue;
	exports.stringify = cstStringify.stringify;
	exports.visit = cstVisit.visit;
	exports.BOM = BOM;
	exports.DOCUMENT = DOCUMENT;
	exports.FLOW_END = FLOW_END;
	exports.SCALAR = SCALAR;
	exports.isCollection = isCollection;
	exports.isScalar = isScalar;
	exports.prettyToken = prettyToken;
	exports.tokenType = tokenType;
}));
// node_modules/yaml/dist/parse/lexer.js
var require_lexer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cst = require_cst();
	function isEmpty(ch) {
		switch (ch) {
			case void 0:
			case " ":
			case "\n":
			case "\r":
			case "	": return true;
			default: return false;
		}
	}
	var hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
	var tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
	var flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
	var invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
	var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
	/**
	* Splits an input string into lexical tokens, i.e. smaller strings that are
	* easily identifiable by `tokens.tokenType()`.
	*
	* Lexing starts always in a "stream" context. Incomplete input may be buffered
	* until a complete token can be emitted.
	*
	* In addition to slices of the original input, the following control characters
	* may also be emitted:
	*
	* - `\x02` (Start of Text): A document starts with the next token
	* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
	* - `\x1f` (Unit Separator): Next token is a scalar value
	* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
	*/
	var Lexer = class {
		constructor() {
			/**
			* Flag indicating whether the end of the current buffer marks the end of
			* all input
			*/
			this.atEnd = false;
			/**
			* Explicit indent set in block scalar header, as an offset from the current
			* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
			* explicitly set.
			*/
			this.blockScalarIndent = -1;
			/**
			* Block scalars that include a + (keep) chomping indicator in their header
			* include trailing empty lines, which are otherwise excluded from the
			* scalar's contents.
			*/
			this.blockScalarKeep = false;
			/** Current input */
			this.buffer = "";
			/**
			* Flag noting whether the map value indicator : can immediately follow this
			* node within a flow context.
			*/
			this.flowKey = false;
			/** Count of surrounding flow collection levels. */
			this.flowLevel = 0;
			/**
			* Minimum level of indentation required for next lines to be parsed as a
			* part of the current scalar value.
			*/
			this.indentNext = 0;
			/** Indentation level of the current line. */
			this.indentValue = 0;
			/** Position of the next \n character. */
			this.lineEndPos = null;
			/** Stores the state of the lexer if reaching the end of incpomplete input */
			this.next = null;
			/** A pointer to `buffer`; the current position of the lexer. */
			this.pos = 0;
		}
		/**
		* Generate YAML tokens from the `source` string. If `incomplete`,
		* a part of the last line may be left as a buffer for the next call.
		*
		* @returns A generator of lexical tokens
		*/
		*lex(source, incomplete = false) {
			if (source) {
				if (typeof source !== "string") throw TypeError("source is not a string");
				this.buffer = this.buffer ? this.buffer + source : source;
				this.lineEndPos = null;
			}
			this.atEnd = !incomplete;
			let next = this.next ?? "stream";
			while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
		}
		atLineEnd() {
			let i = this.pos;
			let ch = this.buffer[i];
			while (ch === " " || ch === "	") ch = this.buffer[++i];
			if (!ch || ch === "#" || ch === "\n") return true;
			if (ch === "\r") return this.buffer[i + 1] === "\n";
			return false;
		}
		charAt(n) {
			return this.buffer[this.pos + n];
		}
		continueScalar(offset) {
			let ch = this.buffer[offset];
			if (this.indentNext > 0) {
				let indent = 0;
				while (ch === " ") ch = this.buffer[++indent + offset];
				if (ch === "\r") {
					const next = this.buffer[indent + offset + 1];
					if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
				}
				return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
			}
			if (ch === "-" || ch === ".") {
				const dt = this.buffer.substr(offset, 3);
				if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
			}
			return offset;
		}
		getLine() {
			let end = this.lineEndPos;
			if (typeof end !== "number" || end !== -1 && end < this.pos) {
				end = this.buffer.indexOf("\n", this.pos);
				this.lineEndPos = end;
			}
			if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
			if (this.buffer[end - 1] === "\r") end -= 1;
			return this.buffer.substring(this.pos, end);
		}
		hasChars(n) {
			return this.pos + n <= this.buffer.length;
		}
		setNext(state) {
			this.buffer = this.buffer.substring(this.pos);
			this.pos = 0;
			this.lineEndPos = null;
			this.next = state;
			return null;
		}
		peek(n) {
			return this.buffer.substr(this.pos, n);
		}
		*parseNext(next) {
			switch (next) {
				case "stream": return yield* this.parseStream();
				case "line-start": return yield* this.parseLineStart();
				case "block-start": return yield* this.parseBlockStart();
				case "doc": return yield* this.parseDocument();
				case "flow": return yield* this.parseFlowCollection();
				case "quoted-scalar": return yield* this.parseQuotedScalar();
				case "block-scalar": return yield* this.parseBlockScalar();
				case "plain-scalar": return yield* this.parsePlainScalar();
			}
		}
		*parseStream() {
			let line = this.getLine();
			if (line === null) return this.setNext("stream");
			if (line[0] === cst.BOM) {
				yield* this.pushCount(1);
				line = line.substring(1);
			}
			if (line[0] === "%") {
				let dirEnd = line.length;
				let cs = line.indexOf("#");
				while (cs !== -1) {
					const ch = line[cs - 1];
					if (ch === " " || ch === "	") {
						dirEnd = cs - 1;
						break;
					} else cs = line.indexOf("#", cs + 1);
				}
				while (true) {
					const ch = line[dirEnd - 1];
					if (ch === " " || ch === "	") dirEnd -= 1;
					else break;
				}
				const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
				yield* this.pushCount(line.length - n);
				this.pushNewline();
				return "stream";
			}
			if (this.atLineEnd()) {
				const sp = yield* this.pushSpaces(true);
				yield* this.pushCount(line.length - sp);
				yield* this.pushNewline();
				return "stream";
			}
			yield cst.DOCUMENT;
			return yield* this.parseLineStart();
		}
		*parseLineStart() {
			const ch = this.charAt(0);
			if (!ch && !this.atEnd) return this.setNext("line-start");
			if (ch === "-" || ch === ".") {
				if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
				const s = this.peek(3);
				if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
					yield* this.pushCount(3);
					this.indentValue = 0;
					this.indentNext = 0;
					return s === "---" ? "doc" : "stream";
				}
			}
			this.indentValue = yield* this.pushSpaces(false);
			if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
			return yield* this.parseBlockStart();
		}
		*parseBlockStart() {
			const [ch0, ch1] = this.peek(2);
			if (!ch1 && !this.atEnd) return this.setNext("block-start");
			if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
				const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
				this.indentNext = this.indentValue + 1;
				this.indentValue += n;
				return "block-start";
			}
			return "doc";
		}
		*parseDocument() {
			yield* this.pushSpaces(true);
			const line = this.getLine();
			if (line === null) return this.setNext("doc");
			let n = yield* this.pushIndicators();
			switch (line[n]) {
				case "#": yield* this.pushCount(line.length - n);
				case void 0:
					yield* this.pushNewline();
					return yield* this.parseLineStart();
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel = 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					return "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "doc";
				case "\"":
				case "'": return yield* this.parseQuotedScalar();
				case "|":
				case ">":
					n += yield* this.parseBlockScalarHeader();
					n += yield* this.pushSpaces(true);
					yield* this.pushCount(line.length - n);
					yield* this.pushNewline();
					return yield* this.parseBlockScalar();
				default: return yield* this.parsePlainScalar();
			}
		}
		*parseFlowCollection() {
			let nl, sp;
			let indent = -1;
			do {
				nl = yield* this.pushNewline();
				if (nl > 0) {
					sp = yield* this.pushSpaces(false);
					this.indentValue = indent = sp;
				} else sp = 0;
				sp += yield* this.pushSpaces(true);
			} while (nl + sp > 0);
			const line = this.getLine();
			if (line === null) return this.setNext("flow");
			if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
				if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
					this.flowLevel = 0;
					yield cst.FLOW_END;
					return yield* this.parseLineStart();
				}
			}
			let n = 0;
			while (line[n] === ",") {
				n += yield* this.pushCount(1);
				n += yield* this.pushSpaces(true);
				this.flowKey = false;
			}
			n += yield* this.pushIndicators();
			switch (line[n]) {
				case void 0: return "flow";
				case "#":
					yield* this.pushCount(line.length - n);
					return "flow";
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel += 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					this.flowKey = true;
					this.flowLevel -= 1;
					return this.flowLevel ? "flow" : "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "flow";
				case "\"":
				case "'":
					this.flowKey = true;
					return yield* this.parseQuotedScalar();
				case ":": {
					const next = this.charAt(1);
					if (this.flowKey || isEmpty(next) || next === ",") {
						this.flowKey = false;
						yield* this.pushCount(1);
						yield* this.pushSpaces(true);
						return "flow";
					}
				}
				default:
					this.flowKey = false;
					return yield* this.parsePlainScalar();
			}
		}
		*parseQuotedScalar() {
			const quote = this.charAt(0);
			let end = this.buffer.indexOf(quote, this.pos + 1);
			if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
			else while (end !== -1) {
				let n = 0;
				while (this.buffer[end - 1 - n] === "\\") n += 1;
				if (n % 2 === 0) break;
				end = this.buffer.indexOf("\"", end + 1);
			}
			const qb = this.buffer.substring(0, end);
			let nl = qb.indexOf("\n", this.pos);
			if (nl !== -1) {
				while (nl !== -1) {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = qb.indexOf("\n", cs);
				}
				if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
			}
			if (end === -1) {
				if (!this.atEnd) return this.setNext("quoted-scalar");
				end = this.buffer.length;
			}
			yield* this.pushToIndex(end + 1, false);
			return this.flowLevel ? "flow" : "doc";
		}
		*parseBlockScalarHeader() {
			this.blockScalarIndent = -1;
			this.blockScalarKeep = false;
			let i = this.pos;
			while (true) {
				const ch = this.buffer[++i];
				if (ch === "+") this.blockScalarKeep = true;
				else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
				else if (ch !== "-") break;
			}
			return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
		}
		*parseBlockScalar() {
			let nl = this.pos - 1;
			let indent = 0;
			let ch;
			loop: for (let i = this.pos; ch = this.buffer[i]; ++i) switch (ch) {
				case " ":
					indent += 1;
					break;
				case "\n":
					nl = i;
					indent = 0;
					break;
				case "\r": {
					const next = this.buffer[i + 1];
					if (!next && !this.atEnd) return this.setNext("block-scalar");
					if (next === "\n") break;
				}
				default: break loop;
			}
			if (!ch && !this.atEnd) return this.setNext("block-scalar");
			if (indent >= this.indentNext) {
				if (this.blockScalarIndent === -1) this.indentNext = indent;
				else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
				do {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = this.buffer.indexOf("\n", cs);
				} while (nl !== -1);
				if (nl === -1) {
					if (!this.atEnd) return this.setNext("block-scalar");
					nl = this.buffer.length;
				}
			}
			let i = nl + 1;
			ch = this.buffer[i];
			while (ch === " ") ch = this.buffer[++i];
			if (ch === "	") {
				while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
				nl = i - 1;
			} else if (!this.blockScalarKeep) do {
				let i = nl - 1;
				let ch = this.buffer[i];
				if (ch === "\r") ch = this.buffer[--i];
				const lastChar = i;
				while (ch === " ") ch = this.buffer[--i];
				if (ch === "\n" && i >= this.pos && i + 1 + indent > lastChar) nl = i;
				else break;
			} while (true);
			yield cst.SCALAR;
			yield* this.pushToIndex(nl + 1, true);
			return yield* this.parseLineStart();
		}
		*parsePlainScalar() {
			const inFlow = this.flowLevel > 0;
			let end = this.pos - 1;
			let i = this.pos - 1;
			let ch;
			while (ch = this.buffer[++i]) if (ch === ":") {
				const next = this.buffer[i + 1];
				if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
				end = i;
			} else if (isEmpty(ch)) {
				let next = this.buffer[i + 1];
				if (ch === "\r") {
					if (next === "\n") {
						i += 1;
						ch = "\n";
						next = this.buffer[i + 1];
					} else end = i;
				}
				if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
				if (ch === "\n") {
					const cs = this.continueScalar(i + 1);
					if (cs === -1) break;
					i = Math.max(i, cs - 2);
				}
			} else {
				if (inFlow && flowIndicatorChars.has(ch)) break;
				end = i;
			}
			if (!ch && !this.atEnd) return this.setNext("plain-scalar");
			yield cst.SCALAR;
			yield* this.pushToIndex(end + 1, true);
			return inFlow ? "flow" : "doc";
		}
		*pushCount(n) {
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos += n;
				return n;
			}
			return 0;
		}
		*pushToIndex(i, allowEmpty) {
			const s = this.buffer.slice(this.pos, i);
			if (s) {
				yield s;
				this.pos += s.length;
				return s.length;
			} else if (allowEmpty) yield "";
			return 0;
		}
		*pushIndicators() {
			let n = 0;
			loop: while (true) {
				switch (this.charAt(0)) {
					case "!":
						n += yield* this.pushTag();
						n += yield* this.pushSpaces(true);
						continue loop;
					case "&":
						n += yield* this.pushUntil(isNotAnchorChar);
						n += yield* this.pushSpaces(true);
						continue loop;
					case "-":
					case "?":
					case ":": {
						const inFlow = this.flowLevel > 0;
						const ch1 = this.charAt(1);
						if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
							if (!inFlow) this.indentNext = this.indentValue + 1;
							else if (this.flowKey) this.flowKey = false;
							n += yield* this.pushCount(1);
							n += yield* this.pushSpaces(true);
							continue loop;
						}
					}
				}
				break loop;
			}
			return n;
		}
		*pushTag() {
			if (this.charAt(1) === "<") {
				let i = this.pos + 2;
				let ch = this.buffer[i];
				while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
				return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
			} else {
				let i = this.pos + 1;
				let ch = this.buffer[i];
				while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
				else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
				else break;
				return yield* this.pushToIndex(i, false);
			}
		}
		*pushNewline() {
			const ch = this.buffer[this.pos];
			if (ch === "\n") return yield* this.pushCount(1);
			else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
			else return 0;
		}
		*pushSpaces(allowTabs) {
			let i = this.pos - 1;
			let ch;
			do
				ch = this.buffer[++i];
			while (ch === " " || allowTabs && ch === "	");
			const n = i - this.pos;
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos = i;
			}
			return n;
		}
		*pushUntil(test) {
			let i = this.pos;
			let ch = this.buffer[i];
			while (!test(ch)) ch = this.buffer[++i];
			return yield* this.pushToIndex(i, false);
		}
	};
	exports.Lexer = Lexer;
}));
// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Tracks newlines during parsing in order to provide an efficient API for
	* determining the one-indexed `{ line, col }` position for any offset
	* within the input.
	*/
	var LineCounter = class {
		constructor() {
			this.lineStarts = [];
			/**
			* Should be called in ascending order. Otherwise, call
			* `lineCounter.lineStarts.sort()` before calling `linePos()`.
			*/
			this.addNewLine = (offset) => this.lineStarts.push(offset);
			/**
			* Performs a binary search and returns the 1-indexed { line, col }
			* position of `offset`. If `line === 0`, `addNewLine` has never been
			* called or `offset` is before the first known newline.
			*/
			this.linePos = (offset) => {
				let low = 0;
				let high = this.lineStarts.length;
				while (low < high) {
					const mid = low + high >> 1;
					if (this.lineStarts[mid] < offset) low = mid + 1;
					else high = mid;
				}
				if (this.lineStarts[low] === offset) return {
					line: low + 1,
					col: 1
				};
				if (low === 0) return {
					line: 0,
					col: offset
				};
				const start = this.lineStarts[low - 1];
				return {
					line: low,
					col: offset - start + 1
				};
			};
		}
	};
	exports.LineCounter = LineCounter;
}));
// node_modules/yaml/dist/parse/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var cst = require_cst();
	var lexer = require_lexer();
	function includesToken(list, type) {
		for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
		return false;
	}
	function findNonEmptyIndex(list) {
		for (let i = 0; i < list.length; ++i) switch (list[i].type) {
			case "space":
			case "comment":
			case "newline": break;
			default: return i;
		}
		return -1;
	}
	function isFlowToken(token) {
		switch (token?.type) {
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "flow-collection": return true;
			default: return false;
		}
	}
	function getPrevProps(parent) {
		switch (parent.type) {
			case "document": return parent.start;
			case "block-map": {
				const it = parent.items[parent.items.length - 1];
				return it.sep ?? it.start;
			}
			case "block-seq": return parent.items[parent.items.length - 1].start;
			/* istanbul ignore next should not happen */
			default: return [];
		}
	}
	/** Note: May modify input array */
	function getFirstKeyStartProps(prev) {
		if (prev.length === 0) return [];
		let i = prev.length;
		loop: while (--i >= 0) switch (prev[i].type) {
			case "doc-start":
			case "explicit-key-ind":
			case "map-value-ind":
			case "seq-item-ind":
			case "newline": break loop;
		}
		while (prev[++i]?.type === "space");
		return prev.splice(i, prev.length);
	}
	function arrayPushArray(target, source) {
		if (source.length < 1e5) Array.prototype.push.apply(target, source);
		else for (let i = 0; i < source.length; ++i) target.push(source[i]);
	}
	function fixFlowSeqItems(fc) {
		if (fc.start.type === "flow-seq-start") {
			for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
				if (it.key) it.value = it.key;
				delete it.key;
				if (isFlowToken(it.value)) {
					if (it.value.end) arrayPushArray(it.value.end, it.sep);
					else it.value.end = it.sep;
				} else arrayPushArray(it.start, it.sep);
				delete it.sep;
			}
		}
	}
	/**
	* A YAML concrete syntax tree (CST) parser
	*
	* ```ts
	* const src: string = ...
	* for (const token of new Parser().parse(src)) {
	*   // token: Token
	* }
	* ```
	*
	* To use the parser with a user-provided lexer:
	*
	* ```ts
	* function* parse(source: string, lexer: Lexer) {
	*   const parser = new Parser()
	*   for (const lexeme of lexer.lex(source))
	*     yield* parser.next(lexeme)
	*   yield* parser.end()
	* }
	*
	* const src: string = ...
	* const lexer = new Lexer()
	* for (const token of parse(src, lexer)) {
	*   // token: Token
	* }
	* ```
	*/
	var Parser = class {
		/**
		* @param onNewLine - If defined, called separately with the start position of
		*   each new line (in `parse()`, including the start of input).
		*/
		constructor(onNewLine) {
			/** If true, space and sequence indicators count as indentation */
			this.atNewLine = true;
			/** If true, next token is a scalar value */
			this.atScalar = false;
			/** Current indentation level */
			this.indent = 0;
			/** Current offset since the start of parsing */
			this.offset = 0;
			/** On the same line with a block map key */
			this.onKeyLine = false;
			/** Top indicates the node that's currently being built */
			this.stack = [];
			/** The source of the current token, set in parse() */
			this.source = "";
			/** The type of the current token, set in parse() */
			this.type = "";
			this.lexer = new lexer.Lexer();
			this.onNewLine = onNewLine;
		}
		/**
		* Parse `source` as a YAML stream.
		* If `incomplete`, a part of the last line may be left as a buffer for the next call.
		*
		* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
		*
		* @returns A generator of tokens representing each directive, document, and other structure.
		*/
		*parse(source, incomplete = false) {
			if (this.onNewLine && this.offset === 0) this.onNewLine(0);
			for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
			if (!incomplete) yield* this.end();
		}
		/**
		* Advance the parser by the `source` of one lexical token.
		*/
		*next(source) {
			this.source = source;
			if (node_process.env.LOG_TOKENS) console.log("|", cst.prettyToken(source));
			if (this.atScalar) {
				this.atScalar = false;
				yield* this.step();
				this.offset += source.length;
				return;
			}
			const type = cst.tokenType(source);
			if (!type) {
				const message = `Not a YAML token: ${source}`;
				yield* this.pop({
					type: "error",
					offset: this.offset,
					message,
					source
				});
				this.offset += source.length;
			} else if (type === "scalar") {
				this.atNewLine = false;
				this.atScalar = true;
				this.type = "scalar";
			} else {
				this.type = type;
				yield* this.step();
				switch (type) {
					case "newline":
						this.atNewLine = true;
						this.indent = 0;
						if (this.onNewLine) this.onNewLine(this.offset + source.length);
						break;
					case "space":
						if (this.atNewLine && source[0] === " ") this.indent += source.length;
						break;
					case "explicit-key-ind":
					case "map-value-ind":
					case "seq-item-ind":
						if (this.atNewLine) this.indent += source.length;
						break;
					case "doc-mode":
					case "flow-error-end": return;
					default: this.atNewLine = false;
				}
				this.offset += source.length;
			}
		}
		/** Call at end of input to push out any remaining constructions */
		*end() {
			while (this.stack.length > 0) yield* this.pop();
		}
		get sourceToken() {
			return {
				type: this.type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		*step() {
			const top = this.peek(1);
			if (this.type === "doc-end" && top?.type !== "doc-end") {
				while (this.stack.length > 0) yield* this.pop();
				this.stack.push({
					type: "doc-end",
					offset: this.offset,
					source: this.source
				});
				return;
			}
			if (!top) return yield* this.stream();
			switch (top.type) {
				case "document": return yield* this.document(top);
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return yield* this.scalar(top);
				case "block-scalar": return yield* this.blockScalar(top);
				case "block-map": return yield* this.blockMap(top);
				case "block-seq": return yield* this.blockSequence(top);
				case "flow-collection": return yield* this.flowCollection(top);
				case "doc-end": return yield* this.documentEnd(top);
			}
			/* istanbul ignore next should not happen */
			yield* this.pop();
		}
		peek(n) {
			return this.stack[this.stack.length - n];
		}
		*pop(error) {
			const token = error ?? this.stack.pop();
			/* istanbul ignore if should not happen */
			if (!token) yield {
				type: "error",
				offset: this.offset,
				source: "",
				message: "Tried to pop an empty stack"
			};
			else if (this.stack.length === 0) yield token;
			else {
				const top = this.peek(1);
				if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
				else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
				if (token.type === "flow-collection") fixFlowSeqItems(token);
				switch (top.type) {
					case "document":
						top.value = token;
						break;
					case "block-scalar":
						top.props.push(token);
						break;
					case "block-map": {
						const it = top.items[top.items.length - 1];
						if (it.value) {
							top.items.push({
								start: [],
								key: token,
								sep: []
							});
							this.onKeyLine = true;
							return;
						} else if (it.sep) it.value = token;
						else {
							Object.assign(it, {
								key: token,
								sep: []
							});
							this.onKeyLine = !it.explicitKey;
							return;
						}
						break;
					}
					case "block-seq": {
						const it = top.items[top.items.length - 1];
						if (it.value) top.items.push({
							start: [],
							value: token
						});
						else it.value = token;
						break;
					}
					case "flow-collection": {
						const it = top.items[top.items.length - 1];
						if (!it || it.value) top.items.push({
							start: [],
							key: token,
							sep: []
						});
						else if (it.sep) it.value = token;
						else Object.assign(it, {
							key: token,
							sep: []
						});
						return;
					}
					/* istanbul ignore next should not happen */
					default:
						yield* this.pop();
						yield* this.pop(token);
				}
				if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
					const last = token.items[token.items.length - 1];
					if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
						if (top.type === "document") top.end = last.start;
						else top.items.push({ start: last.start });
						token.items.splice(-1, 1);
					}
				}
			}
		}
		*stream() {
			switch (this.type) {
				case "directive-line":
					yield {
						type: "directive",
						offset: this.offset,
						source: this.source
					};
					return;
				case "byte-order-mark":
				case "space":
				case "comment":
				case "newline":
					yield this.sourceToken;
					return;
				case "doc-mode":
				case "doc-start": {
					const doc = {
						type: "document",
						offset: this.offset,
						start: []
					};
					if (this.type === "doc-start") doc.start.push(this.sourceToken);
					this.stack.push(doc);
					return;
				}
			}
			yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML stream`,
				source: this.source
			};
		}
		*document(doc) {
			if (doc.value) return yield* this.lineEnd(doc);
			switch (this.type) {
				case "doc-start":
					if (findNonEmptyIndex(doc.start) !== -1) {
						yield* this.pop();
						yield* this.step();
					} else doc.start.push(this.sourceToken);
					return;
				case "anchor":
				case "tag":
				case "space":
				case "comment":
				case "newline":
					doc.start.push(this.sourceToken);
					return;
			}
			const bv = this.startBlockValue(doc);
			if (bv) this.stack.push(bv);
			else yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML document`,
				source: this.source
			};
		}
		*scalar(scalar) {
			if (this.type === "map-value-ind") {
				const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
				let sep;
				if (scalar.end) {
					sep = scalar.end;
					sep.push(this.sourceToken);
					delete scalar.end;
				} else sep = [this.sourceToken];
				const map = {
					type: "block-map",
					offset: scalar.offset,
					indent: scalar.indent,
					items: [{
						start,
						key: scalar,
						sep
					}]
				};
				this.onKeyLine = true;
				this.stack[this.stack.length - 1] = map;
			} else yield* this.lineEnd(scalar);
		}
		*blockScalar(scalar) {
			switch (this.type) {
				case "space":
				case "comment":
				case "newline":
					scalar.props.push(this.sourceToken);
					return;
				case "scalar":
					scalar.source = this.source;
					this.atNewLine = true;
					this.indent = 0;
					if (this.onNewLine) {
						let nl = this.source.indexOf("\n") + 1;
						while (nl !== 0) {
							this.onNewLine(this.offset + nl);
							nl = this.source.indexOf("\n", nl) + 1;
						}
					}
					yield* this.pop();
					break;
				/* istanbul ignore next should not happen */
				default:
					yield* this.pop();
					yield* this.step();
			}
		}
		*blockMap(map) {
			const it = map.items[map.items.length - 1];
			switch (this.type) {
				case "newline":
					this.onKeyLine = false;
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else map.items.push({ start: [this.sourceToken] });
					} else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) map.items.push({ start: [this.sourceToken] });
					else if (it.sep) it.sep.push(this.sourceToken);
					else {
						if (this.atIndentedComment(it.start, map.indent)) {
							const end = map.items[map.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								map.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
			}
			if (this.indent >= map.indent) {
				const atMapIndent = !this.onKeyLine && this.indent === map.indent;
				const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
				let start = [];
				if (atNextItem && it.sep && !it.value) {
					const nl = [];
					for (let i = 0; i < it.sep.length; ++i) {
						const st = it.sep[i];
						switch (st.type) {
							case "newline":
								nl.push(i);
								break;
							case "space": break;
							case "comment":
								if (st.indent > map.indent) nl.length = 0;
								break;
							default: nl.length = 0;
						}
					}
					if (nl.length >= 2) start = it.sep.splice(nl[1]);
				}
				switch (this.type) {
					case "anchor":
					case "tag":
						if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({ start });
							this.onKeyLine = true;
						} else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "explicit-key-ind":
						if (!it.sep && !it.explicitKey) {
							it.start.push(this.sourceToken);
							it.explicitKey = true;
						} else if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({
								start,
								explicitKey: true
							});
						} else this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [this.sourceToken],
								explicitKey: true
							}]
						});
						this.onKeyLine = true;
						return;
					case "map-value-ind":
						if (it.explicitKey) {
							if (!it.sep) {
								if (includesToken(it.start, "newline")) Object.assign(it, {
									key: null,
									sep: [this.sourceToken]
								});
								else {
									const start = getFirstKeyStartProps(it.start);
									this.stack.push({
										type: "block-map",
										offset: this.offset,
										indent: this.indent,
										items: [{
											start,
											key: null,
											sep: [this.sourceToken]
										}]
									});
								}
							} else if (it.value) map.items.push({
								start: [],
								key: null,
								sep: [this.sourceToken]
							});
							else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start,
									key: null,
									sep: [this.sourceToken]
								}]
							});
							else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
								const start = getFirstKeyStartProps(it.start);
								const key = it.key;
								const sep = it.sep;
								sep.push(this.sourceToken);
								delete it.key;
								delete it.sep;
								this.stack.push({
									type: "block-map",
									offset: this.offset,
									indent: this.indent,
									items: [{
										start,
										key,
										sep
									}]
								});
							} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
							else it.sep.push(this.sourceToken);
						} else if (!it.sep) Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.value || atNextItem) map.items.push({
							start,
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [],
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else it.sep.push(this.sourceToken);
						this.onKeyLine = true;
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (atNextItem || it.value) {
							map.items.push({
								start,
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						} else if (it.sep) this.stack.push(fs);
						else {
							Object.assign(it, {
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						}
						return;
					}
					default: {
						const bv = this.startBlockValue(map);
						if (bv) {
							if (bv.type === "block-seq") {
								if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
									yield* this.pop({
										type: "error",
										offset: this.offset,
										message: "Unexpected block-seq-ind on same line with key",
										source: this.source
									});
									return;
								}
							} else if (atMapIndent) map.items.push({ start });
							this.stack.push(bv);
							return;
						}
					}
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*blockSequence(seq) {
			const it = seq.items[seq.items.length - 1];
			switch (this.type) {
				case "newline":
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else seq.items.push({ start: [this.sourceToken] });
					} else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) seq.items.push({ start: [this.sourceToken] });
					else {
						if (this.atIndentedComment(it.start, seq.indent)) {
							const end = seq.items[seq.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								seq.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
				case "anchor":
				case "tag":
					if (it.value || this.indent <= seq.indent) break;
					it.start.push(this.sourceToken);
					return;
				case "seq-item-ind":
					if (this.indent !== seq.indent) break;
					if (it.value || includesToken(it.start, "seq-item-ind")) seq.items.push({ start: [this.sourceToken] });
					else it.start.push(this.sourceToken);
					return;
			}
			if (this.indent > seq.indent) {
				const bv = this.startBlockValue(seq);
				if (bv) {
					this.stack.push(bv);
					return;
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*flowCollection(fc) {
			const it = fc.items[fc.items.length - 1];
			if (this.type === "flow-error-end") {
				let top;
				do {
					yield* this.pop();
					top = this.peek(1);
				} while (top?.type === "flow-collection");
			} else if (fc.end.length === 0) {
				switch (this.type) {
					case "comma":
					case "explicit-key-ind":
						if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
						else it.start.push(this.sourceToken);
						return;
					case "map-value-ind":
						if (!it || it.value) fc.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.sep) it.sep.push(this.sourceToken);
						else Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						return;
					case "space":
					case "comment":
					case "newline":
					case "anchor":
					case "tag":
						if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
						else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (!it || it.value) fc.items.push({
							start: [],
							key: fs,
							sep: []
						});
						else if (it.sep) this.stack.push(fs);
						else Object.assign(it, {
							key: fs,
							sep: []
						});
						return;
					}
					case "flow-map-end":
					case "flow-seq-end":
						fc.end.push(this.sourceToken);
						return;
				}
				const bv = this.startBlockValue(fc);
				/* istanbul ignore else should not happen */
				if (bv) this.stack.push(bv);
				else {
					yield* this.pop();
					yield* this.step();
				}
			} else {
				const parent = this.peek(2);
				if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
					yield* this.pop();
					yield* this.step();
				} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
					const start = getFirstKeyStartProps(getPrevProps(parent));
					fixFlowSeqItems(fc);
					const sep = fc.end.splice(1, fc.end.length);
					sep.push(this.sourceToken);
					const map = {
						type: "block-map",
						offset: fc.offset,
						indent: fc.indent,
						items: [{
							start,
							key: fc,
							sep
						}]
					};
					this.onKeyLine = true;
					this.stack[this.stack.length - 1] = map;
				} else yield* this.lineEnd(fc);
			}
		}
		flowScalar(type) {
			if (this.onNewLine) {
				let nl = this.source.indexOf("\n") + 1;
				while (nl !== 0) {
					this.onNewLine(this.offset + nl);
					nl = this.source.indexOf("\n", nl) + 1;
				}
			}
			return {
				type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		startBlockValue(parent) {
			switch (this.type) {
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return this.flowScalar(this.type);
				case "block-scalar-header": return {
					type: "block-scalar",
					offset: this.offset,
					indent: this.indent,
					props: [this.sourceToken],
					source: ""
				};
				case "flow-map-start":
				case "flow-seq-start": return {
					type: "flow-collection",
					offset: this.offset,
					indent: this.indent,
					start: this.sourceToken,
					items: [],
					end: []
				};
				case "seq-item-ind": return {
					type: "block-seq",
					offset: this.offset,
					indent: this.indent,
					items: [{ start: [this.sourceToken] }]
				};
				case "explicit-key-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					start.push(this.sourceToken);
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							explicitKey: true
						}]
					};
				}
				case "map-value-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							key: null,
							sep: [this.sourceToken]
						}]
					};
				}
			}
			return null;
		}
		atIndentedComment(start, indent) {
			if (this.type !== "comment") return false;
			if (this.indent <= indent) return false;
			return start.every((st) => st.type === "newline" || st.type === "space");
		}
		*documentEnd(docEnd) {
			if (this.type !== "doc-mode") {
				if (docEnd.end) docEnd.end.push(this.sourceToken);
				else docEnd.end = [this.sourceToken];
				if (this.type === "newline") yield* this.pop();
			}
		}
		*lineEnd(token) {
			switch (this.type) {
				case "comma":
				case "doc-start":
				case "doc-end":
				case "flow-seq-end":
				case "flow-map-end":
				case "map-value-ind":
					yield* this.pop();
					yield* this.step();
					break;
				case "newline": this.onKeyLine = false;
				default:
					if (token.end) token.end.push(this.sourceToken);
					else token.end = [this.sourceToken];
					if (this.type === "newline") yield* this.pop();
			}
		}
	};
	exports.Parser = Parser;
}));
// node_modules/yaml/dist/public-api.js
var require_public_api = /* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var errors = require_errors();
	var log = require_log();
	var identity = require_identity();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	function parseOptions(options) {
		const prettyErrors = options.prettyErrors !== false;
		return {
			lineCounter: options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null,
			prettyErrors
		};
	}
	/**
	* Parse the input as a stream of YAML documents.
	*
	* Documents should be separated from each other by `...` or `---` marker lines.
	*
	* @returns If an empty `docs` array is returned, it will be of type
	*   EmptyStream and contain additional stream information. In
	*   TypeScript, you should use `'empty' in docs` as a type guard for it.
	*/
	function parseAllDocuments(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		const docs = Array.from(composer$1.compose(parser$1.parse(source)));
		if (prettyErrors && lineCounter) for (const doc of docs) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		if (docs.length > 0) return docs;
		return Object.assign([], { empty: true }, composer$1.streamInfo());
	}
	/** Parse an input string into a single YAML.Document */
	function parseDocument(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		let doc = null;
		for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) if (!doc) doc = _doc;
		else if (doc.options.logLevel !== "silent") {
			doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
			break;
		}
		if (prettyErrors && lineCounter) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		return doc;
	}
	function parse(src, reviver, options) {
		let _reviver = void 0;
		if (typeof reviver === "function") _reviver = reviver;
		else if (options === void 0 && reviver && typeof reviver === "object") options = reviver;
		const doc = parseDocument(src, options);
		if (!doc) return null;
		doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
		if (doc.errors.length > 0) {
			if (doc.options.logLevel !== "silent") throw doc.errors[0];
			else doc.errors = [];
		}
		return doc.toJS(Object.assign({ reviver: _reviver }, options));
	}
	function stringify(value, replacer, options) {
		let _replacer = null;
		if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
		else if (options === void 0 && replacer) options = replacer;
		if (typeof options === "string") options = options.length;
		if (typeof options === "number") {
			const indent = Math.round(options);
			options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
		}
		if (value === void 0) {
			const { keepUndefined } = options ?? replacer ?? {};
			if (!keepUndefined) return void 0;
		}
		if (identity.isDocument(value) && !_replacer) return value.toString(options);
		return new Document.Document(value, _replacer, options).toString(options);
	}
	exports.parse = parse;
	exports.parseAllDocuments = parseAllDocuments;
	exports.parseDocument = parseDocument;
	exports.stringify = stringify;
}));
// node_modules/yaml/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var Schema = require_Schema();
	var errors = require_errors();
	var Alias = require_Alias();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	require_cst();
	var lexer = require_lexer();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	var publicApi = require_public_api();
	var visit = require_visit();
	exports.Composer = composer.Composer;
	exports.Document = Document.Document;
	exports.Schema = Schema.Schema;
	exports.YAMLError = errors.YAMLError;
	exports.YAMLParseError = errors.YAMLParseError;
	exports.YAMLWarning = errors.YAMLWarning;
	exports.Alias = Alias.Alias;
	exports.isAlias = identity.isAlias;
	exports.isCollection = identity.isCollection;
	exports.isDocument = identity.isDocument;
	exports.isMap = identity.isMap;
	exports.isNode = identity.isNode;
	exports.isPair = identity.isPair;
	exports.isScalar = identity.isScalar;
	exports.isSeq = identity.isSeq;
	exports.Pair = Pair.Pair;
	exports.Scalar = Scalar.Scalar;
	exports.YAMLMap = YAMLMap.YAMLMap;
	exports.YAMLSeq = YAMLSeq.YAMLSeq;
	exports.Lexer = lexer.Lexer;
	exports.LineCounter = lineCounter.LineCounter;
	exports.Parser = parser.Parser;
	exports.parse = publicApi.parse;
	exports.parseAllDocuments = publicApi.parseAllDocuments;
	exports.parseDocument = publicApi.parseDocument;
	exports.stringify = publicApi.stringify;
	exports.visit = visit.visit;
	exports.visitAsync = visit.visitAsync;
}));
require_lib();
var import_dist = require_dist();
/** 짧은 무작위 id. 예: newId('card') → 'card-3f9a1c2b' */
function newId(prefix) {
	return `${prefix}-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
// src/converters/meta.ts
/** 메타 주석 한 줄을 만든다. 실을 정보가 없으면 null. */
function metaLine(meta) {
	if (Object.keys(meta).length === 0) return null;
	return `# teamcook: ${JSON.stringify(meta)}`;
}
/** 줄바꿈을 \n으로 통일하고 앞뒤 공백을 정리한다. */
function normalizeText(text) {
	return text.replace(/\r\n?/g, "\n").trim();
}
// src/converters/instructions.ts
/** 덧붙인 부분의 시작을 알리는 줄. 다시 불러올 때 이 줄부터 잘라 원본 지시문을 되살린다. */
var STRUCT_MARKER = "--- 역할 카드에서 정한 내용 (teamcook이 덧붙임) ---";
function list(title, items) {
	const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
	return clean.length > 0 ? [
		"",
		`[${title}]`,
		...clean.map((item) => `- ${item}`)
	] : [];
}
function deliverableLine(item) {
	return item.description?.trim() ? `${item.name.trim()}: ${item.description.trim()}` : item.name.trim();
}
/** 구조화된 항목만 글로 옮긴 것. 항목이 하나도 없으면 빈 문자열. 순서는 항상 같다. */
function structuredBlock(card) {
	const lines = [
		...list("받을 입력", card.requiredInputs),
		...list("필수 산출물 (끝날 때 반드시 내놓는다)", (card.deliverables ?? []).filter((item) => item.name.trim()).map(deliverableLine)),
		...list("완료 기준 (모두 만족해야 끝난 것이다)", card.completionCriteria),
		...list("하지 않을 일", card.boundaries)
	];
	return lines.length > 0 ? [STRUCT_MARKER, ...lines.slice(1)].join("\n") : "";
}
/** 실제 설정 파일에 들어갈 지시문: 원본 지시문 + 구조화된 항목 */
function composeInstructions(card) {
	const original = normalizeText(card.instructions);
	const block = structuredBlock(card);
	if (!block) return original;
	return original ? `${original}\n\n${block}` : block;
}
/** 메타 주석에 구조화된 항목을 싣는다 (다시 불러올 때 되살리려고). */
function addSpecMeta(meta, card) {
	const spec = {};
	if (card.requiredInputs?.length) spec.inputs = card.requiredInputs;
	if (card.deliverables?.length) spec.deliverables = card.deliverables;
	if (card.completionCriteria?.length) spec.criteria = card.completionCriteria;
	if (card.boundaries?.length) spec.boundaries = card.boundaries;
	if (Object.keys(spec).length > 0) meta.spec = spec;
}
// src/converters/claude.ts
/** 읽기 전용 카드의 기본 도구 */
var CLAUDE_READONLY_TOOLS = [
	"Read",
	"Grep",
	"Glob"
];
/** 편집 카드의 기본 도구 */
var CLAUDE_EDIT_TOOLS = [
	"Read",
	"Grep",
	"Glob",
	"Edit",
	"Write",
	"Bash"
];
/** 파일을 바꾸거나 명령을 실행할 수 있는 도구 */
var WRITE_TOOLS = /* @__PURE__ */ new Set([
	"Edit",
	"Write",
	"MultiEdit",
	"NotebookEdit",
	"Bash",
	"PowerShell"
]);
function defaultTools$1(permission) {
	if (permission === "read-only") return CLAUDE_READONLY_TOOLS;
	if (permission === "edit") return CLAUDE_EDIT_TOOLS;
}
/** 도구 목록에서 권한을 짐작한다. 예: ['Read','Grep'] → 'read-only' */
function permissionFromTools$1(tools) {
	if (!tools) return "full";
	return tools.some((tool) => WRITE_TOOLS.has(tool.split("(")[0].trim())) ? "edit" : "read-only";
}
/** 카드 → Claude Code 서브에이전트 파일 내용 */
function cardToClaudeMd(card) {
	const isNative = card.preferredEngine === "claude-code";
	const tools = card.tools && card.tools.length > 0 ? card.tools : defaultTools$1(card.permission);
	const meta = {};
	if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
	if (card.tags && card.tags.length > 0) meta.tags = card.tags;
	if (permissionFromTools$1(tools) !== card.permission) meta.permission = card.permission;
	if (!isNative) meta.engine = card.preferredEngine;
	if (card.model && !isNative) meta.model = card.model;
	addSpecMeta(meta, card);
	const frontmatter = {
		name: card.name,
		description: card.role
	};
	if (tools) frontmatter.tools = tools.join(", ");
	if (card.model && isNative) frontmatter.model = card.model;
	Object.assign(frontmatter, card.extra?.claude ?? {});
	const yaml = (0, import_dist.stringify)(frontmatter, { lineWidth: 0 }).trimEnd();
	const comment = metaLine(meta);
	return `---\n${comment ? `${comment}\n${yaml}` : yaml}\n---\n\n${composeInstructions(card)}\n`;
}
// node_modules/smol-toml/dist/stringify.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var BARE_KEY = /^[a-z0-9-_]+$/i;
var HAS_WELLFORMED = !!"".isWellFormed;
function extendedTypeOf(obj) {
	let type = typeof obj;
	if (type === "object") {
		if (Array.isArray(obj)) return "array";
		if (typeof obj.getUTCDate === "function" && obj instanceof Date) return "date";
		if (globalThis.Temporal) {
			if (obj.until) {
				if (obj instanceof Temporal.ZonedDateTime) return "temporal/tz+uc";
				if (obj instanceof Temporal.PlainDateTime || obj instanceof Temporal.PlainDate) return "temporal/uc";
				if (obj instanceof Temporal.PlainTime || obj instanceof Temporal.Instant) return "temporal";
				if (obj instanceof Temporal.PlainYearMonth) return "temporal/x";
			} else if (obj.toPlainDate && obj instanceof Temporal.PlainMonthDay || obj.negated && obj instanceof Temporal.Duration) return "temporal/x";
		}
	}
	return type;
}
function isArrayOfTables(obj) {
	for (let i = 0; i < obj.length; i++) if (extendedTypeOf(obj[i]) !== "object") return false;
	return obj.length != 0;
}
function formatWellFormedStringUnchecked(s) {
	return JSON.stringify(s).replaceAll("", "\\u007f");
}
function formatString(s) {
	return formatWellFormedStringUnchecked(HAS_WELLFORMED ? s.toWellFormed() : s);
}
function formatKey(s) {
	if (BARE_KEY.test(s)) return s;
	if (HAS_WELLFORMED && !s.isWellFormed()) throw new RangeError("key contains illegal lone surrogates");
	return formatWellFormedStringUnchecked(s);
}
function stringifyValue(val, type, depth, numberAsFloat, strictTemporal) {
	if (depth === 0) throw new Error("Could not stringify the object: maximum object depth exceeded");
	switch (type) {
		case "number":
			if (isNaN(val)) return "nan";
			if (val === Infinity) return "inf";
			if (val === -Infinity) return "-inf";
			if (Number.isInteger(val) && (numberAsFloat || !Number.isSafeInteger(val))) return val.toFixed(1);
		case "bigint":
		case "boolean":
		case "temporal": return val.toString();
		case "string": return formatString(val);
		case "date":
			if (isNaN(val.getTime())) throw new TypeError("cannot serialize invalid date");
			return val.toISOString();
		case "object": return stringifyInlineTable(val, depth, numberAsFloat, strictTemporal);
		case "array": return stringifyArray(val, depth, numberAsFloat, strictTemporal);
		case "temporal/tz+uc": if (strictTemporal) {
			let tz = val.timeZoneId;
			let tzc = tz.charCodeAt(0);
			if (tzc !== 43 && tzc !== 45 && (tzc !== 85 && tzc !== 71 && tzc !== 90 && tzc !== 69 || tz !== "UTC" && tz !== "UCT" && tz !== "Universal" && tz !== "Zulu" && !tz.startsWith("GMT") && tz !== "Greenwich" && !tz.startsWith("Etc/"))) throw new TypeError("Temporal objects with an IANA timezone are not allowed in Temporal strict mode");
		}
		case "temporal/uc":
			if (strictTemporal && val.calendarId !== "iso8601") throw new TypeError("Temporal objects with a non-default calendar are not allowed in Temporal strict mode");
			return val.toString({
				calendarName: "never",
				timeZoneName: "never"
			});
		case "temporal/x": throw new TypeError("Unsupported " + val[Symbol.toStringTag]);
	}
}
function stringifyInlineTable(obj, depth, numberAsFloat, strictTemporal) {
	let keys = Object.keys(obj);
	if (keys.length === 0) return "{}";
	let res = "{ ";
	for (let i = 0; i < keys.length; i++) {
		let k = keys[i];
		if (i) res += ", ";
		res += formatKey(k) + " = " + stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat, strictTemporal);
	}
	return res + " }";
}
function stringifyArray(array, depth, numberAsFloat, strictTemporal) {
	if (array.length === 0) return "[]";
	let res = "[ ";
	for (let i = 0; i < array.length; i++) {
		if (i) res += ", ";
		if (array[i] === null || array[i] === void 0) throw new TypeError("arrays cannot contain null or undefined values");
		res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat, strictTemporal);
	}
	return res + " ]";
}
function stringifyArrayTable(array, key, depth, numberAsFloat, strictTemporal) {
	if (depth === 0) throw new Error("Could not stringify the object: maximum object depth exceeded");
	let res = "";
	for (let i = 0; i < array.length; i++) {
		res += `${res && "\n"}[[${key}]]\n`;
		res += stringifyTable(0, array[i], key, depth, numberAsFloat, strictTemporal);
	}
	return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat, strictTemporal) {
	if (depth === 0) throw new Error("Could not stringify the object: maximum object depth exceeded");
	let preamble = "";
	let tables = "";
	let keys = Object.keys(obj);
	for (let i = 0; i < keys.length; i++) {
		let k = keys[i];
		if (obj[k] !== null && obj[k] !== void 0) {
			let type = extendedTypeOf(obj[k]);
			if (type === "symbol" || type === "function") throw new TypeError(`cannot serialize values of type '${type}'`);
			let key = formatKey(k);
			if (type === "array" && isArrayOfTables(obj[k])) tables += (tables && "\n") + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat, strictTemporal);
			else if (type === "object") {
				let tblKey = prefix ? `${prefix}.${key}` : key;
				tables += (tables && "\n") + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat, strictTemporal);
			} else {
				preamble += key;
				preamble += " = ";
				preamble += stringifyValue(obj[k], type, depth, numberAsFloat, strictTemporal);
				preamble += "\n";
			}
		}
	}
	if (tableKey && (preamble || !tables)) preamble = preamble ? `[${tableKey}]\n${preamble}` : `[${tableKey}]`;
	return preamble && tables ? `${preamble}\n${tables}` : preamble || tables;
}
function stringify(obj, { maxDepth = 1e3, numbersAsFloat = false, strictTemporal = false } = {}) {
	if (extendedTypeOf(obj) !== "object") throw new TypeError("stringify can only be called with an object");
	let str = stringifyTable(0, obj, "", maxDepth, numbersAsFloat, strictTemporal);
	if (str[str.length - 1] !== "\n") return str + "\n";
	return str;
}
// node_modules/smol-toml/dist/index.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
// src/converters/codex.ts
/** 읽기 전용 카드의 지시문 끝에 붙이는 문장. 불러올 때는 이 문장을 떼어 내고 권한으로 되돌린다. */
var CODEX_READONLY_GUARD = "[권한: 읽기 전용] 파일을 만들거나 수정하지 마라. 고칠 점이 있으면 직접 고치지 말고 제안으로만 보고하라.";
/** TOML 한 줄 문자열 */
function tomlString(value) {
	return JSON.stringify(value).replace(/\u007f/g, "\\u007F");
}
/** TOML 여러 줄 문자열 ("""...""") */
function tomlMultiline(value) {
	return `"""\n${value.replace(/\\/g, "\\\\").replace(/"""/g, "\"\"\\\"").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (ch) => {
		return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}`;
	})}\n"""`;
}
/** 카드 → Codex TOML 파일 내용 */
function cardToCodexToml(card) {
	const isNative = card.preferredEngine === "codex-cli";
	const meta = {};
	if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
	if (card.tags && card.tags.length > 0) meta.tags = card.tags;
	if (card.permission !== "full") meta.permission = card.permission;
	if (!isNative) meta.engine = card.preferredEngine;
	if (card.model && !isNative) meta.model = card.model;
	if (card.tools && card.tools.length > 0) meta.tools = card.tools;
	addSpecMeta(meta, card);
	let instructions = composeInstructions(card);
	if (card.permission === "read-only") instructions = instructions ? `${instructions}\n\n${CODEX_READONLY_GUARD}` : CODEX_READONLY_GUARD;
	const lines = [];
	const comment = metaLine(meta);
	if (comment) lines.push(comment);
	lines.push(`name = ${tomlString(card.name)}`);
	lines.push(`description = ${tomlString(card.role)}`);
	if (card.model && isNative) lines.push(`model = ${tomlString(card.model)}`);
	lines.push(`developer_instructions = ${tomlMultiline(instructions)}`);
	const extra = card.extra?.codex ?? {};
	if (Object.keys(extra).length > 0) lines.push(stringify(extra).trimEnd());
	return `${lines.join("\n")}\n`;
}
/** 레시피 → 프로젝트 설정(.codex/config.toml) 내용 */
function recipeToCodexConfig(recipe) {
	const threads = Math.max(1, Math.round(recipe.settings.maxThreads));
	return [
		`# teamcook 레시피: ${recipe.title.replace(/[\r\n]+/g, " ")}`,
		"# 동시에 열 수 있는 서브에이전트 수 (메인 세션 제외)",
		"[agents]",
		`max_concurrent_threads_per_session = ${threads}`,
		""
	].join("\n");
}
// src/converters/markdownAgents.ts
var ANTIGRAVITY = {
	engine: "antigravity-cli",
	extraKey: "antigravity",
	label: "Antigravity",
	tools: {
		readOnly: ["view_file", "grep_search"],
		edit: [
			"view_file",
			"grep_search",
			"replace_file_content",
			"run_command"
		],
		write: ["replace_file_content", "run_command"]
	},
	tagFormat: false
};
var GROK = {
	engine: "grok-build",
	extraKey: "grok",
	label: "Grok Build",
	tagFormat: true
};
function toList(value) {
	if (Array.isArray(value)) return value.map((item) => String(item).trim());
	if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function defaultTools(format, permission) {
	if (!format.tools || permission === "full") return void 0;
	return permission === "read-only" ? format.tools.readOnly : format.tools.edit;
}
function permissionFromTools(format, tools) {
	if (!format.tools || !tools) return "full";
	return tools.some((tool) => format.tools.write.includes(tool)) ? "edit" : "read-only";
}
function toMarkdown(card, format) {
	const isNative = card.preferredEngine === format.engine;
	const { tools: savedTools, ...rest } = card.extra?.[format.extraKey] ?? {};
	const tools = toList(savedTools) ?? defaultTools(format, card.permission);
	const meta = {};
	if (card.displayName && card.displayName !== card.name) meta.displayName = card.displayName;
	if (card.tags && card.tags.length > 0) meta.tags = card.tags;
	if (permissionFromTools(format, tools) !== card.permission) meta.permission = card.permission;
	if (!isNative) meta.engine = card.preferredEngine;
	if (card.model && !isNative) meta.model = card.model;
	if (card.tools && card.tools.length > 0) meta.tools = card.tools;
	if (format.tagFormat) meta.format = "grok";
	addSpecMeta(meta, card);
	const frontmatter = {
		name: card.name,
		description: card.role
	};
	if (tools) frontmatter.tools = tools;
	if (card.model && isNative) frontmatter.model = card.model;
	Object.assign(frontmatter, rest);
	let instructions = composeInstructions(card);
	if (!format.tools && card.permission === "read-only") instructions = instructions ? `${instructions}\n\n${CODEX_READONLY_GUARD}` : CODEX_READONLY_GUARD;
	const yaml = (0, import_dist.stringify)(frontmatter, { lineWidth: 0 }).trimEnd();
	const comment = metaLine(meta);
	return `---\n${comment ? `${comment}\n` : ""}${yaml}\n---\n\n${instructions}\n`;
}
/** 카드 → Antigravity 커스텀 에이전트 파일 내용 */
var cardToAntigravityMd = (card) => toMarkdown(card, ANTIGRAVITY);
/** 카드 → Grok Build 에이전트 파일 내용 */
var cardToGrokMd = (card) => toMarkdown(card, GROK);
// src/lib/bridge.ts
/** Claude Code 카드와 Codex 카드가 섞인 레시피에서만 다리가 의미가 있다. */
function needsCodexBridge(recipe) {
	const engines = new Set(recipe.cards.map((card) => card.preferredEngine));
	return engines.has("claude-code") && engines.has("codex-cli");
}
/** Codex 담당 카드를 Claude Code에서 부르기 위한 '다리' 서브에이전트 파일 내용 */
function codexBridgeMd(card) {
	const sandbox = card.permission === "read-only" ? "read-only" : "workspace-write";
	const frontmatter = {
		name: card.name,
		description: `${card.role} (Codex에게 맡겨서 처리한다)`,
		tools: "Bash, Read"
	};
	const body = [
		`너는 '${card.displayName || card.name}' 역할의 연결 담당이다. 이 역할의 실제 작업은 OpenAI Codex가 한다.`,
		"너는 직접 분석하거나 고치지 말고, 아래 순서대로 Codex에게 일을 넘기고 결과를 전달만 한다.",
		"",
		"1. 부모에게서 받은 요청을 한 문단으로 정리한다. 필요한 파일 경로와 맥락을 빠짐없이 넣는다",
		"   (Codex는 이 대화를 볼 수 없다).",
		"2. 아래 명령을 Bash로 실행한다. `<요청>` 자리에 1번에서 정리한 내용을 넣는다.",
		"",
		"```bash",
		`codex exec --sandbox ${sandbox} "${card.name} 에이전트에게 다음 일을 맡기고, 그 결과를 그대로 보고해 줘: <요청>"`,
		"```",
		"",
		"3. Codex가 출력한 결과를 요약하거나 고치지 말고 그대로 부모에게 전달한다.",
		"4. 명령이 실패하면(설치·로그인 문제, 사용량 한도 등) 오류 메시지를 그대로 전달하고 멈춘다.",
		"   직접 대신 처리하지 않는다."
	].join("\n");
	return `---\n${`# teamcook: ${JSON.stringify({ bridge: "codex-exec" })}`}\n${(0, import_dist.stringify)(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${body}\n`;
}
/** 사용량을 많이 쓰는 무거운 역할 */
var HEAVY = ["writer", "implementer"];
var has = (card, tags) => (card.tags ?? []).some((tag) => tags.includes(tag));
var isReviewer = (card) => has(card, ["reviewer"]);
/** 교차 검토에서 '작성자'로 보는 역할 */
var isWriter = (card) => has(card, HEAVY);
var isHeavy = (card) => has(card, HEAVY);
// src/lib/support.ts
var ENFORCEMENT_LABELS = {
	instruction: "지시문으로 안내",
	"tool-limit": "도구 제한",
	"env-required": "실행 환경 설정 필요",
	unknown: "확인 필요"
};
/** 이 카드가 실제로 돌게 되는 도구 (에이전트 팀은 전부 Claude Code, 토론형은 프롬프트) */
function effectiveEngine(card, style) {
	if (style === "debate") return "manual";
	if (style === "agent-team") return "claude-code";
	return card.preferredEngine;
}
/** 카드의 권한 선택이 내보낸 설정에서 어떻게 지켜지는지 */
function permissionSupport(card, style) {
	const engine = effectiveEngine(card, style);
	const readOnly = card.permission === "read-only";
	if (style === "debate") return {
		modes: ["instruction"],
		text: "토론형은 프롬프트만 씁니다. 권한은 설정 파일로 제한되지 않고, 붙여 넣는 AI의 설정을 그대로 따릅니다."
	};
	if (engine === "claude-code") {
		const custom = card.tools && card.tools.length > 0 ? card.tools : void 0;
		if (card.permission === "full" && !custom) return {
			modes: ["env-required"],
			text: "도구를 제한하지 않습니다. 무엇을 할 수 있는지는 Claude Code 메인 세션의 권한 설정을 따릅니다."
		};
		if (custom && permissionFromTools$1(custom) !== card.permission) return {
			modes: ["unknown"],
			text: `직접 적은 도구 목록(${custom.join(", ")})이 고른 권한과 맞지 않습니다. 파일에는 적은 목록이 그대로 들어가므로, 권한이 지켜지는지 목록을 확인하세요.`
		};
		const tools = custom ?? (readOnly ? CLAUDE_READONLY_TOOLS : CLAUDE_EDIT_TOOLS);
		return readOnly ? {
			modes: ["tool-limit"],
			text: `Claude Code 설정의 tools를 ${tools.join(", ")}로 제한합니다. 파일을 고치는 도구가 목록에 없습니다.`
		} : {
			modes: ["tool-limit", "env-required"],
			text: `Claude Code 설정의 tools를 ${tools.join(", ")}로 적습니다. 실제로 수정을 허락할지는 Claude Code의 권한 설정(물어보기, 자동 허용 등)을 따릅니다.`
		};
	}
	if (engine === "codex-cli") return readOnly ? {
		modes: ["instruction", "env-required"],
		text: "Codex는 에이전트 파일로 읽기 전용을 강제할 수 없습니다. 지시문 끝에 \"수정하지 마라\"는 문장을 넣을 뿐이고, 기술적으로 막으려면 codex --sandbox read-only 로 실행해야 합니다."
	} : {
		modes: ["env-required"],
		text: "Codex는 에이전트 파일로 권한을 바꿀 수 없습니다. 메인 세션의 샌드박스·승인 설정을 그대로 물려받습니다."
	};
	if (engine === "antigravity-cli") return readOnly ? {
		modes: ["tool-limit", "unknown"],
		text: "설정의 tools를 읽기 도구(view_file, grep_search)로 적습니다. 형식은 공식 문서로 확인했지만 실제 Antigravity에서 막히는지는 실행해 보지 못했습니다."
	} : {
		modes: ["unknown"],
		text: "Antigravity에서 이 권한이 어떻게 적용되는지 실행해 확인하지 못했습니다."
	};
	if (engine === "grok-build") return readOnly ? {
		modes: ["instruction", "unknown"],
		text: "Grok Build는 도구 이름 목록을 확인하지 못해, 지시문 끝에 \"수정하지 마라\"는 문장만 넣습니다. 기술적으로 막지 않습니다."
	} : {
		modes: ["unknown"],
		text: "Grok Build에서 이 권한이 어떻게 적용되는지 확인하지 못했습니다."
	};
	return {
		modes: ["instruction"],
		text: "설정 파일을 쓰지 않는 경로입니다. 권한은 지시문으로만 안내되고, 붙여 넣는 AI의 설정을 따릅니다."
	};
}
/** 설계한 내용이 내보낸 파일과 프롬프트의 어디에 들어가는지 (실제 생성 로직 기준) */
function reflectionScope(recipe, providers) {
	const style = collaborationOf(recipe);
	const engines = [...new Set(recipe.cards.map((card) => effectiveEngine(card, style)))];
	const extra = ["antigravity-cli", "grok-build"].filter((id) => engines.includes(id)).map((id) => providers.engines[id].configFormat ?? providers.engines[id].name);
	const modes = /* @__PURE__ */ new Set();
	for (const card of recipe.cards) for (const mode of permissionSupport(card, style).modes) modes.add(mode);
	const permissionRow = {
		item: "권한 제한",
		where: [...modes].map((mode) => ENFORCEMENT_LABELS[mode]).join(", ") || "카드 없음",
		note: "카드마다 수단이 다릅니다. 역할별 설명을 확인하세요. \"읽기 전용\"을 골랐다고 항상 기술적으로 막히는 것은 아닙니다."
	};
	if (style === "debate") return [
		{
			item: "역할 정의",
			where: "토론 프롬프트 (debate-prompt.txt, RECIPE.md)",
			note: "설정 파일은 만들지 않습니다."
		},
		{
			item: "작업 순서",
			where: "토론 프롬프트의 진행 순서",
			note: "AI가 프롬프트를 따르는 만큼만 지켜집니다. 사이트가 순서를 강제하지 않습니다."
		},
		{
			item: "산출물·완료 기준",
			where: "토론 프롬프트의 역할 설명",
			note: "역할마다 내놓을 것과 끝나는 조건을 프롬프트에 적습니다."
		},
		{
			item: "팀원 메시지",
			where: "해당 없음",
			note: "한 AI가 여러 역할을 번갈아 맡습니다. 별도 세션끼리 주고받는 협업과는 다릅니다."
		},
		permissionRow
	];
	if (style === "agent-team") return [
		{
			item: "역할 정의",
			where: ".claude/agents/*.md",
			note: "팀원을 만들 때 \"에이전트 유형\"으로 씁니다. 리더는 처음 연 대화창이라 파일이 없습니다."
		},
		{
			item: "작업 순서",
			where: "첫 프롬프트, RECIPE.md",
			note: "리더가 프롬프트를 읽고 일을 나눕니다. 사이트나 파일이 순서를 강제하지 않습니다."
		},
		{
			item: "산출물·완료 기준",
			where: "각 팀원 파일의 지시문 끝",
			note: "팀원의 지시문에 덧붙습니다."
		},
		{
			item: "팀원 메시지",
			where: "Claude Code 에이전트 팀 기능",
			note: "팀원끼리의 메시지와 공용 할 일 목록은 Claude Code가 제공합니다(실험 기능, 공식 문서로 확인). 에이전트 팀을 켜는 설정은 .claude/settings.json에 들어갑니다."
		},
		permissionRow
	];
	return [
		{
			item: "역할 정의",
			where: [
				".codex/agents/*.toml",
				".claude/agents/*.md",
				...extra
			].join(", "),
			note: "모든 역할을 Codex와 Claude Code 두 형식으로 넣습니다. 쓰지 않는 쪽은 지워도 됩니다."
		},
		{
			item: "작업 순서",
			where: "첫 프롬프트, RECIPE.md",
			note: "메인 AI가 프롬프트를 읽고 순서대로 맡깁니다. 사이트나 파일이 순서를 강제하지 않습니다."
		},
		{
			item: "산출물·완료 기준",
			where: "각 역할 파일의 지시문 끝",
			note: "역할의 지시문에 덧붙습니다."
		},
		{
			item: "팀원 메시지",
			where: "설정하지 않음",
			note: "내보낸 서브에이전트는 결과를 메인 AI에게 돌려줍니다. 서브에이전트끼리 직접 소통할 수 있는지는 도구마다 다르고, 이 사이트는 그것을 설정하지 않습니다."
		},
		permissionRow
	];
}
/** '내 플랜으로 가능' 옆에 항상 붙이는 문장 */
var PLAN_FIT_NOTE = "선택한 요금제 정보를 기준으로 찾은 실행 경로입니다. 이 PC의 설치·로그인·실제 실행 상태는 확인하지 않았습니다.";
/** 흐름 영역에 항상 붙이는 문장 */
var FLOW_NOTE = "이 흐름은 시작 프롬프트와 설명서에 반영됩니다. 사이트가 실제 실행 순서를 강제하지는 않습니다.";
// src/lib/exportCheck.ts
/** 넘겨주기가 가리키는 산출물: 찾은 것과, 지워져서 못 찾은 id */
function handoffDeliverables(recipe, handoff) {
	const from = recipe.cards.find((card) => card.id === handoff.from);
	const found = [];
	const missing = [];
	for (const id of handoff.deliverableIds ?? []) {
		const deliverable = from?.deliverables?.find((item) => item.id === id);
		if (deliverable) found.push(deliverable);
		else missing.push(id);
	}
	return {
		found,
		missing
	};
}
// src/lib/resolvePath.ts
var PATH_NAMES = {
	1: "구독 로그인",
	2: "API 키 (종량제)",
	3: "무료·제한 경로",
	4: "수동 (복사·붙여넣기)"
};
var PATH_SYMBOLS = {
	1: "①",
	2: "②",
	3: "③",
	4: "④"
};
var MANUAL_LABEL = "무료 웹 채팅에 프롬프트를 복사·붙여넣기";
/** 이 엔진을 내 플랜으로 쓸 수 있는 가장 좋은 조건. 없으면 null. */
function bestAccess(engineId, plans, providers) {
	const engine = providers.engines[engineId];
	if (!engine) return null;
	if (engineId === "api") return Object.values(plans.apiKeys).some(Boolean) ? {
		path: 2,
		apiKey: true,
		label: "API 키 (종량제)",
		notes: []
	} : null;
	if (!engine.provider) return null;
	const myPlan = plans[engine.provider];
	const hasKey = plans.apiKeys[engine.provider] === true;
	return engine.access.filter((rule) => rule.apiKey ? hasKey : (rule.plans ?? []).includes(myPlan)).sort((a, b) => a.path - b.path)[0] ?? null;
}
/** 실제로 쓰게 되는 엔진과 경로 (막혔고 대안이 있으면 대안 쪽) */
function effectiveRoute(resolution) {
	if (resolution.locked && resolution.alternative) return {
		engine: resolution.alternative.engine,
		path: resolution.alternative.path
	};
	return {
		engine: resolution.engine,
		path: resolution.path
	};
}
/** 내보내기를 지원하는(ready) 다른 엔진 중 내 플랜으로 쓸 수 있는 것들 */
function otherEngines(except, plans, providers) {
	const result = [];
	for (const [id, engine] of Object.entries(providers.engines)) {
		const engineId = id;
		if (engineId === except || engine.status !== "ready" || !engine.provider) continue;
		const rule = bestAccess(engineId, plans, providers);
		if (rule) result.push({
			engineId,
			rule,
			provider: engine.provider
		});
	}
	return result;
}
function isOfficial(engineId, providers) {
	return providers.engines[engineId]?.confidence === "official";
}
/** 요금제를 공식 문서로 확인하지 못한 도구에 붙이는 안내 */
function unverifiedNote(engineId, providers) {
	const engine = providers.engines[engineId];
	if (!engine || engine.status === "builtin" || engine.confidence === "official") return [];
	return [`${engine.name}의 요금제 정보는 공식 문서로 확인하지 못했어요. 실제와 다를 수 있어요.`];
}
/** 무료 계정만 만들면 쓸 수 있는 엔진이 있으면 안내 문장을 만든다. */
function signupHints(plans, providers) {
	const hints = [];
	for (const engine of Object.values(providers.engines)) {
		if (engine.status !== "ready" || !engine.provider) continue;
		if (engine.access.find((rule) => rule.free && (rule.plans ?? []).includes("free")) && plans[engine.provider] === "none") {
			const product = providers.providers[engine.provider].productName;
			hints.push(`${product} 무료 계정을 만들면 ${engine.name}를 무료 한도로 쓸 수 있어요.`);
		}
	}
	return hints;
}
/**
* 카드 하나의 실행 경로를 정한다.
* context.writerProviders를 주면 검토자 카드에 교차 검토 규칙을 적용한다.
*/
function resolvePath(card, plans, providers, context = {}) {
	const engine = providers.engines[card.preferredEngine];
	const writerProviders = context.writerProviders ?? [];
	const reviewer = isReviewer(card);
	if (card.preferredEngine === "manual" || !engine) return {
		path: 4,
		engine: "manual",
		label: MANUAL_LABEL,
		locked: false,
		notes: []
	};
	const own = bestAccess(card.preferredEngine, plans, providers);
	const others = otherEngines(card.preferredEngine, plans, providers);
	if (own) {
		const notes = [...own.notes, ...unverifiedNote(card.preferredEngine, providers)];
		if (engine.status === "preparing") notes.push(`${engine.name} 설정 파일 내보내기는 준비 중이에요. 지금은 Codex·Claude 형식으로만 내보내져요.`);
		const resolution = {
			path: own.path,
			engine: card.preferredEngine,
			label: own.label,
			locked: false,
			notes
		};
		if (reviewer && engine.provider && writerProviders.includes(engine.provider)) {
			const cross = others.filter((candidate) => !writerProviders.includes(candidate.provider)).sort((a, b) => a.rule.path - b.rule.path || Number(isOfficial(b.engineId, providers)) - Number(isOfficial(a.engineId, providers)))[0];
			if (cross) resolution.alternative = {
				engine: cross.engineId,
				path: cross.rule.path,
				label: cross.rule.label,
				kind: "suggestion",
				reason: `작성자와 같은 회사 모델이에요. ${providers.engines[cross.engineId].name}(${cross.rule.label})로 교차 검토하면 놓치는 게 줄어요.`
			};
			return resolution;
		}
		if (isHeavy(card) && own.path === 3) {
			const paid = others.find((candidate) => candidate.rule.path === 1);
			if (paid) resolution.alternative = {
				engine: paid.engineId,
				path: 1,
				label: paid.rule.label,
				kind: "suggestion",
				reason: `무거운 역할이라 무료 한도보다 구독(${providers.engines[paid.engineId].name})에 맡기는 편이 좋아요.`
			};
		}
		return resolution;
	}
	const heavy = isHeavy(card);
	const best = [...others].sort((a, b) => {
		if (reviewer) {
			const diff = Number(writerProviders.includes(a.provider)) - Number(writerProviders.includes(b.provider));
			if (diff !== 0) return diff;
		}
		if (a.rule.path !== b.rule.path) return a.rule.path - b.rule.path;
		const official = Number(isOfficial(b.engineId, providers)) - Number(isOfficial(a.engineId, providers));
		if (official !== 0) return official;
		const freeDiff = Number(a.rule.free === true) - Number(b.rule.free === true);
		return heavy ? freeDiff : -freeDiff;
	})[0];
	const resolution = {
		path: 4,
		engine: "manual",
		label: MANUAL_LABEL,
		locked: true,
		lockReason: engine.lockReason,
		notes: []
	};
	if (best) {
		const name = providers.engines[best.engineId].name;
		const crossReview = reviewer && !writerProviders.includes(best.provider) && writerProviders.length > 0;
		resolution.alternative = {
			engine: best.engineId,
			path: best.rule.path,
			label: best.rule.label,
			kind: "fallback",
			reason: crossReview ? `대신 ${name}(${best.rule.label})로 교차 검토할 수 있어요.` : `대신 ${name}(${best.rule.label})로 실행할 수 있어요.`
		};
		resolution.notes.push(...best.rule.notes, ...unverifiedNote(best.engineId, providers));
	} else resolution.notes.push("지금 플랜으로는 자동 실행 경로가 없어요. 무료 웹 채팅에 직접 복사·붙여넣기 해야 해요.", ...signupHints(plans, providers));
	return resolution;
}
function providerOf(engineId, providers) {
	return providers.engines[engineId]?.provider ?? null;
}
function countPaths(recipe, perCard) {
	const counts = {
		1: 0,
		2: 0,
		3: 0,
		4: 0
	};
	let fallbackCount = 0;
	for (const card of recipe.cards) {
		const resolution = perCard[card.id];
		counts[effectiveRoute(resolution).path] += 1;
		if (resolution.locked && resolution.alternative) fallbackCount += 1;
	}
	return {
		counts,
		fallbackCount
	};
}
/**
* 에이전트 팀 조리법: 팀원은 전부 Claude Code 안에서 돈다 (카드에 적힌 도구와 상관없이).
* Claude Code를 못 쓰면 🔒이고, 대안은 "서브에이전트 조리법으로 바꿔 쓰기"다.
*/
function resolveAgentTeam(recipe, plans, providers) {
	const info = COLLABORATIONS$1["agent-team"];
	const claude = providers.engines["claude-code"];
	const perCard = {};
	for (const card of recipe.cards) {
		const resolution = resolvePath({
			...card,
			preferredEngine: "claude-code"
		}, plans, providers);
		if (resolution.locked) {
			resolution.lockReason = `에이전트 팀은 Claude Code에서만 돌아가요. ${claude.lockReason}`;
			if (resolution.alternative) {
				const alt = resolution.alternative;
				resolution.alternative = {
					...alt,
					reason: `조리법을 '서브에이전트'로 바꾸면 ${providers.engines[alt.engine].name}(${alt.label})로 실행할 수 있어요.`
				};
			}
		} else delete resolution.alternative;
		perCard[card.id] = resolution;
	}
	const { counts, fallbackCount } = countPaths(recipe, perCard);
	const locked = bestAccess("claude-code", plans, providers) === null;
	const base = summarize(recipe.cards.length, counts, fallbackCount);
	const result = {
		perCard,
		summary: locked && recipe.cards.length > 0 ? `에이전트 팀은 Claude Code가 있어야 해요. 서브에이전트 조리법으로 바꾸면 ${base}` : base,
		counts,
		fallbackCount,
		crossReview: "n/a",
		styleNotes: info.notes
	};
	if (locked) result.styleLock = {
		reason: `에이전트 팀은 Claude Code에서만 돌아가요. ${claude.lockReason}`,
		suggestion: "조리법을 '서브에이전트'로 바꾸면 같은 역할 카드를 내 플랜으로 쓸 수 있는 다른 도구에서 돌릴 수 있어요.",
		switchTo: "subagents"
	};
	return result;
}
/** 토론형 조리법: 설정 파일 없이 프롬프트 하나를 붙여 넣는다. 플랜과 상관없이 누구나 쓸 수 있다. */
function resolveDebate(recipe) {
	const perCard = {};
	for (const card of recipe.cards) perCard[card.id] = {
		path: 4,
		engine: "manual",
		label: "토론 프롬프트 안의 한 역할 (AI 하나가 번갈아 맡아요)",
		locked: false,
		notes: []
	};
	const { counts, fallbackCount } = countPaths(recipe, perCard);
	return {
		perCard,
		summary: recipe.cards.length === 0 ? "아직 카드가 없어요." : "프롬프트 하나만 붙여 넣으면 돼요. 무료 웹 채팅을 포함해 어느 AI에서나 됩니다.",
		counts,
		fallbackCount,
		crossReview: "n/a",
		styleNotes: COLLABORATIONS$1.debate.notes
	};
}
/** 레시피 전체의 실행 경로를 정하고 한 줄 요약을 만든다. 조리법(협업 방식)도 반영한다. */
function resolveRecipe(recipe, plans, providers) {
	const style = collaborationOf(recipe);
	if (style === "agent-team") return resolveAgentTeam(recipe, plans, providers);
	if (style === "debate") return resolveDebate(recipe);
	const perCard = {};
	for (const card of recipe.cards) perCard[card.id] = resolvePath(card, plans, providers);
	const writerProviders = [];
	for (const card of recipe.cards.filter(isWriter)) {
		const provider = providerOf(effectiveRoute(perCard[card.id]).engine, providers);
		if (provider && !writerProviders.includes(provider)) writerProviders.push(provider);
	}
	const reviewers = recipe.cards.filter((card) => isReviewer(card) && !isWriter(card));
	for (const card of reviewers) perCard[card.id] = resolvePath(card, plans, providers, { writerProviders });
	let crossReview = "n/a";
	if (reviewers.length > 0 && writerProviders.length > 0) crossReview = reviewers.every((card) => {
		const provider = providerOf(effectiveRoute(perCard[card.id]).engine, providers);
		return provider !== null && !writerProviders.includes(provider);
	}) ? "ok" : "same-provider";
	const { counts, fallbackCount } = countPaths(recipe, perCard);
	return {
		perCard,
		summary: summarize(recipe.cards.length, counts, fallbackCount),
		counts,
		fallbackCount,
		crossReview,
		styleNotes: []
	};
}
function summarize(total, counts, fallbackCount) {
	if (total === 0) return "아직 카드가 없어요.";
	const words = {
		1: "구독으로",
		2: "API 키로",
		3: "무료 한도로",
		4: "수동(복사·붙여넣기)으로만"
	};
	const used = [
		1,
		2,
		3,
		4
	].filter((path) => counts[path] > 0);
	const tail = fallbackCount > 0 ? ` (${fallbackCount}개는 대안 도구로 바꿔서)` : "";
	if (used.length === 1) {
		const only = used[0];
		const verb = only === 4 ? "할 수 있어요" : "실행돼요";
		return `${total}개 모두 ${words[only]} ${verb}${tail}`;
	}
	return `${total}개 중 ${used.map((path) => `${counts[path]}개는 ${words[path]}`).join(", ")} 실행돼요${tail}`;
}
// src/lib/requiredPlans.ts
function requiredPlans(recipe, providers) {
	const style = collaborationOf(recipe);
	if (recipe.cards.length === 0) return {
		badges: [],
		allFree: true,
		details: []
	};
	if (style === "debate") {
		const badge = {
			engine: "manual",
			text: "어느 AI든 무료로 가능",
			free: true,
			notes: COLLABORATIONS$1.debate.notes
		};
		return {
			badges: [badge.text],
			allFree: true,
			details: [badge]
		};
	}
	const engines = [];
	if (style === "agent-team") engines.push("claude-code");
	else for (const card of recipe.cards) if (!engines.includes(card.preferredEngine)) engines.push(card.preferredEngine);
	const details = [];
	for (const engineId of engines) {
		const engine = providers.engines[engineId];
		if (!engine || engineId === "manual") continue;
		if (engineId === "api") {
			details.push({
				engine: engineId,
				text: "API 키 필요",
				free: false,
				notes: []
			});
			continue;
		}
		const cheapest = engine.access.filter((rule) => rule.plans && rule.badge).sort((a, b) => b.path - a.path)[0];
		if (!cheapest || !cheapest.badge) continue;
		details.push({
			engine: engineId,
			text: cheapest.badge,
			free: cheapest.free === true,
			notes: style === "agent-team" ? [...cheapest.notes, COLLABORATIONS$1["agent-team"].notes[0]] : cheapest.notes
		});
	}
	details.sort((a, b) => Number(a.free) - Number(b.free));
	const allFree = details.every((badge) => badge.free);
	const finished = details.map((badge) => allFree ? {
		...badge,
		text: `${badge.text}로 가능`
	} : badge);
	return {
		badges: finished.map((badge) => badge.text),
		allFree,
		details: finished
	};
}
// src/lib/verification.ts
var KIND_LABELS = {
	docs: "문서 확인",
	file: "파일 생성 확인",
	run: "실제 실행 확인",
	unclassified: "확인 방식 미기록"
};
var KIND_HINTS = {
	docs: "공식 문서의 설정 형식과 맞는지 확인했어요. 실행해 본 것은 아니에요.",
	file: "설정 파일과 설명서가 만들어지는 것을 확인했어요. 실행해 본 것은 아니에요.",
	run: "실제 도구에서 돌려 보고 적은 기록이에요.",
	unclassified: "예전 형식의 날짜만 남아 있어요. 무엇을 어떻게 확인했는지는 기록이 없어요."
};
var RESULT_LABELS = {
	success: "성공",
	failure: "실패",
	"n/a": "해당 없음"
};
var SOURCE_LABELS = {
	user: "사용자 기록",
	auto: "자동 점검",
	author: "만든 쪽 기록",
	unknown: "출처 모름"
};
/** 한 줄 요약. 예: '파일 생성 확인 · 2026-11-16 · 성공 · 자동 점검' */
function verificationLine(record) {
	const parts = [KIND_LABELS[record.kind], record.checkedAt];
	if (record.kind !== "unclassified") parts.push(RESULT_LABELS[record.result]);
	parts.push(SOURCE_LABELS[record.source]);
	return parts.join(" · ");
}
/** 도구·버전·환경을 적은 것만 이어 붙인다. 없으면 빈 문자열 (짐작해서 채우지 않는다). */
function verificationDetail(record) {
	return [
		record.tool,
		record.toolVersion,
		record.environment
	].filter(Boolean).join(", ");
}
// src/lib/recipeMd.ts
var PERMISSION_LABELS = {
	"read-only": "읽기 전용",
	edit: "편집 가능",
	full: "제한 없음 (메인 세션 설정을 따름)"
};
/**
* zip에 넣을 형식들. Codex와 Claude Code는 항상 넣고,
* Antigravity·Grok은 그 도구를 쓰는 카드가 있을 때(원래 설정이든, 내 플랜 기준 대안이든)만 넣는다.
*/
function exportEngines(recipe, providers, plans) {
	const style = collaborationOf(recipe);
	if (style === "agent-team") return ["claude-code"];
	if (style === "debate") return [];
	const used = new Set(recipe.cards.map((card) => card.preferredEngine));
	if (plans) {
		const resolved = resolveRecipe(recipe, plans, providers);
		for (const card of recipe.cards) used.add(effectiveRoute(resolved.perCard[card.id]).engine);
	}
	const engines = ["codex-cli", "claude-code"];
	for (const extra of ["antigravity-cli", "grok-build"]) if (used.has(extra)) engines.push(extra);
	return engines;
}
/** 표 칸 안에서 깨지지 않게 줄바꿈과 | 를 정리한다. */
function cell(value) {
	return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
function cardLabel(card) {
	return card.displayName && card.displayName !== card.name ? `${card.displayName}(\`${card.name}\`)` : `\`${card.name}\``;
}
/**
* 넘겨주기 흐름을 바탕으로 "첫 프롬프트" 예시를 만든다.
* 에이전트 파일에는 흐름이 담기지 않으므로, 흐름은 첫 프롬프트로 알려 줘야 한다.
*/
/** 넘겨주기 한 건의 전달 정보: 직접 쓴 설명과 고른 산출물. 예: '(변경 내용 전달: 변경 요약, 테스트 결과)' */
function handoffWhat(recipe, handoff) {
	const names = handoffDeliverables(recipe, handoff).found.map((item) => item.name).join(", ");
	const label = handoff.label?.trim() ?? "";
	if (label && names) return `(${label}: ${names})`;
	if (label || names) return `(${label || names})`;
	return "";
}
/** 역할별 산출물을 한 줄로. 예: 'writer(변경 요약, 테스트 결과) / reviewer(지적 목록)' */
function deliverableSummary(recipe, useDisplayName = false) {
	return recipe.cards.filter((card) => card.deliverables?.length).map((card) => {
		return `${useDisplayName ? card.displayName || card.name : card.name}(${card.deliverables.map((item) => item.name).join(", ")})`;
	}).join(" / ");
}
/** 프롬프트 끝에 붙이는 '마지막 정리' 지시: 누가 모으고, 어떤 형식으로 내놓는지 */
function wrapUpLines(recipe, who) {
	const outputs = deliverableSummary(recipe);
	const criteria = recipe.successCriteria ?? [];
	if (!outputs && criteria.length === 0) return [];
	const lines = [`모든 단계가 끝나면 ${who} 결과를 하나로 모아 아래 형식으로 정리해 줘.`];
	if (outputs) lines.push(`- 역할별 산출물: ${outputs}`);
	if (criteria.length > 0) {
		lines.push("- 성공 조건을 만족했는지 하나씩 확인:");
		criteria.forEach((item, index) => lines.push(`  ${index + 1}) ${item}`));
	}
	lines.push("- 확인하지 못한 것과 남은 문제");
	return lines;
}
function taskLines(recipe) {
	const lines = ["할 일: (여기에 요청을 적으세요)"];
	if (recipe.sampleTask?.trim()) lines.push(`과제 예시: ${recipe.sampleTask.trim()}`);
	return lines;
}
function starterPrompt(recipe) {
	const steps = flowSteps(recipe, (from, to, what) => `${from.name}의 결과${what}를 ${to.name}에게 넘긴다`);
	const wrapUp = wrapUpLines(recipe, "네가(메인)");
	if (steps.length === 0) return [`${recipe.cards.map((card) => card.name).join(", ")} 에이전트를 써서 다음 일을 해 줘: (여기에 요청을 적으세요)`, ...[...recipe.sampleTask?.trim() ? [`과제 예시: ${recipe.sampleTask.trim()}`] : [], ...wrapUp]].join("\n");
	const first = new Map(recipe.cards.map((card) => [card.id, card])).get(recipe.handoffs[0].from);
	return [
		"아래 순서대로 서브에이전트에게 일을 맡겨 줘.",
		`1. ${first ? first.name : "첫 에이전트"}가 먼저 일한다.`,
		...steps.map((step, index) => `${index + 2}. ${step}.`),
		...wrapUp,
		...taskLines(recipe)
	].join("\n");
}
function flowSteps(recipe, verb) {
	const byId = new Map(recipe.cards.map((card) => [card.id, card]));
	const steps = [];
	for (const handoff of recipe.handoffs) {
		const from = byId.get(handoff.from);
		const to = byId.get(handoff.to);
		if (!from || !to) continue;
		steps.push(verb(from, to, handoffWhat(recipe, handoff)));
	}
	return steps;
}
/**
* 에이전트 팀을 시작하는 첫 프롬프트.
* 공식 문서(2026-11-16 확인)대로 자연어로 팀원을 소개하고, 팀원마다 같은 이름의
* 서브에이전트 정의(.claude/agents/<이름>.md)를 '에이전트 유형'으로 쓰게 한다.
*/
function teamPrompt(recipe) {
	const steps = flowSteps(recipe, (from, to, what) => `${from.name}의 결과${what}를 ${to.name}에게 넘긴다`);
	const lines = [
		"에이전트 팀을 만들어 줘. 서브에이전트가 아니라 에이전트 팀으로 진행해.",
		"너는 리더다. 직접 작업하지 말고, 일을 나눠 맡기고 팀원들의 결과를 모아 정리해 줘.",
		"",
		`팀원 ${recipe.cards.length}명 (각각 같은 이름의 에이전트 유형을 써서 만든다):`,
		...recipe.cards.map((card) => `- ${card.name} 에이전트 유형으로 팀원 1명 — ${card.displayName || card.name}: ${cell(card.role)}`)
	];
	if (steps.length > 0) lines.push("", "일하는 순서:", ...steps.map((step, index) => `${index + 1}. ${step}.`));
	const wrapUp = wrapUpLines(recipe, "리더인 네가");
	if (wrapUp.length > 0) lines.push("", ...wrapUp);
	lines.push("", ...taskLines(recipe));
	return lines.join("\n");
}
/** 토론형 프롬프트. 설정 파일 없이, 어느 AI 채팅에나 그대로 붙여 넣는다. */
function debatePrompt(recipe) {
	const names = recipe.cards.map((card) => card.displayName || card.name);
	const first = names[0] ?? "사회자";
	const steps = flowSteps(recipe, (from, to, what) => `[${from.displayName || from.name}] 역할의 발언${what}을 [${to.displayName || to.name}] 역할이 이어받는다`);
	const lines = [
		`지금부터 너 혼자서 아래 ${recipe.cards.length}명의 역할을 번갈아 맡아 토론해 줘.`,
		"",
		"주제: (여기에 결정하고 싶은 것을 적으세요)",
		...recipe.sampleTask?.trim() ? [`주제 예시: ${recipe.sampleTask.trim()}`] : [],
		"",
		"[역할]"
	];
	recipe.cards.forEach((card, index) => {
		lines.push(`${index + 1}. ${card.displayName || card.name} — ${cell(card.role)}`);
		for (const line of card.instructions.split(/\r?\n/)) if (line.trim()) lines.push(`   ${line.trim()}`);
		if (card.requiredInputs?.length) lines.push(`   받는 것: ${card.requiredInputs.join(" / ")}`);
		if (card.deliverables?.length) lines.push(`   내놓을 것: ${card.deliverables.map((item) => item.name).join(" / ")}`);
		if (card.completionCriteria?.length) lines.push(`   끝나는 조건: ${card.completionCriteria.join(" / ")}`);
		if (card.boundaries?.length) lines.push(`   하지 않을 일: ${card.boundaries.join(" / ")}`);
	});
	lines.push("", "[진행 순서]");
	if (steps.length > 0) {
		lines.push(`1. [${first}] 역할이 먼저 주제와 판단 기준을 정리한다.`);
		steps.forEach((step, index) => lines.push(`${index + 2}. ${step}.`));
	} else lines.push(...names.map((name, index) => `${index + 1}. [${name}] 역할이 발언한다.`));
	lines.push("", "[규칙]", "- 발언마다 맨 앞에 [역할 이름]을 붙인다.", "- 역할끼리 쉽게 동의하지 않는다. 앞선 발언의 약한 부분을 구체적으로 짚는다.", "- 확인한 사실, 추론, 확인하지 못한 것을 구분한다. 수치나 출처를 지어내지 않는다.", "- 위 순서를 두 바퀴 돈다. 둘째 바퀴에서는 첫째 바퀴에서 나온 반론에 답한다.", `- 마지막에 [${first}] 역할이 "결론 / 근거 / 남은 쟁점 / 다음에 할 일"을 정리한다.`);
	if (recipe.successCriteria?.length) {
		lines.push("- 정리할 때 아래 조건을 만족했는지 하나씩 확인한다.");
		recipe.successCriteria.forEach((item, index) => lines.push(`  ${index + 1}) ${item}`));
	}
	return lines.join("\n");
}
/** RECIPE.md 내용을 만든다. plans를 주면 '내 플랜 기준 실행 경로'도 적는다. */
function buildRecipeMd(recipe, providers, plans) {
	const required = requiredPlans(recipe, providers);
	const byId = new Map(recipe.cards.map((card) => [card.id, card]));
	const hasReadOnly = recipe.cards.some((card) => card.permission === "read-only");
	const engines = exportEngines(recipe, providers, plans);
	const style = collaborationOf(recipe);
	const styleInfo = COLLABORATIONS$1[style];
	const out = [];
	out.push(`# ${recipe.title}`, "");
	if (recipe.summary) out.push(recipe.summary, "");
	if (recipe.useCase) out.push(`- **쓰임새:** ${recipe.useCase}`);
	if (recipe.author) out.push(`- **만든 사람:** ${recipe.author}`);
	out.push(`- **조리법(협업 방식):** ${styleInfo.label}${styleInfo.experimental ? " (실험 기능)" : ""} — ${styleInfo.availability}`);
	out.push(`- **필요한 플랜:** ${required.badges.length > 0 ? required.badges.join(" · ") : "없음"} (${providers.lastVerified} 확인)`);
	for (const badge of required.details) for (const note of badge.notes) out.push(`  - ${note}`);
	out.push("");
	out.push("## 이 레시피로 익히는 것", "");
	out.push(`- **학습 목표:** ${recipe.learningObjective?.trim() || "(적혀 있지 않아요)"}`);
	if (recipe.sampleTask?.trim()) out.push(`- **입력 과제 예시:** ${cell(recipe.sampleTask)}`);
	out.push("- **실습 성공 조건:**");
	const success = recipe.successCriteria ?? [];
	if (success.length === 0) out.push("  - (적혀 있지 않아요)");
	success.forEach((item, index) => out.push(`  ${index + 1}. ${item}`));
	out.push("");
	out.push("## 준비", "");
	for (const item of recipe.prerequisites ?? []) out.push(`- ${item}`);
	out.push("- 도구가 설치돼 있고 로그인돼 있어야 합니다. teamcook 사이트는 이 PC의 설치·로그인 상태를 확인하지 않았습니다.", "");
	out.push("## 팀 구성", "", "| 에이전트 | 하는 일 | 권장 도구 | 권한 |", "| --- | --- | --- | --- |");
	for (const card of recipe.cards) {
		const engine = style === "agent-team" ? providers.engines["claude-code"].name : style === "debate" ? "프롬프트 안의 역할" : providers.engines[card.preferredEngine]?.name ?? card.preferredEngine;
		out.push(`| ${cell(cardLabel(card))} | ${cell(card.role)} | ${engine} | ${PERMISSION_LABELS[card.permission]} |`);
	}
	out.push("");
	out.push("### 역할별 작업·산출물·완료 기준", "");
	for (const card of recipe.cards) {
		const support = permissionSupport(card, style);
		out.push(`**${cardLabel(card)}**`, "");
		out.push(`- 맡을 일: ${cell(card.role) || "(적혀 있지 않아요)"}`);
		if (card.requiredInputs?.length) out.push(`- 받을 입력: ${card.requiredInputs.join(" / ")}`);
		out.push(`- 필수 산출물: ${card.deliverables?.length ? card.deliverables.map((item) => item.description ? `${item.name} (${item.description})` : item.name).join(" / ") : "(적혀 있지 않아요)"}`);
		out.push(`- 완료 기준: ${card.completionCriteria?.length ? card.completionCriteria.join(" / ") : "(적혀 있지 않아요)"}`);
		if (card.boundaries?.length) out.push(`- 하지 않을 일: ${card.boundaries.join(" / ")}`);
		out.push(`- 권한: ${PERMISSION_LABELS[card.permission]} — ${support.modes.map((mode) => ENFORCEMENT_LABELS[mode]).join(", ")}. ${support.text}`, "");
	}
	if (recipe.handoffs.length > 0) {
		out.push("## 전달 흐름 (누가 누구에게 무엇을 넘기나)", "");
		recipe.handoffs.forEach((handoff, index) => {
			const from = byId.get(handoff.from);
			const to = byId.get(handoff.to);
			if (!from || !to) return;
			const { found, missing } = handoffDeliverables(recipe, handoff);
			const label = handoff.label ? `: ${handoff.label}` : "";
			out.push(`${index + 1}. ${cardLabel(from)} → ${cardLabel(to)}${label}`);
			if (found.length > 0) out.push(`   - 넘기는 산출물: ${found.map((item) => item.name).join(", ")}`);
			if (missing.length > 0) out.push("   - (지워진 산출물을 가리키고 있어요. 다시 골라야 합니다.)");
			if (found.length === 0 && !handoff.label) out.push("   - (무엇을 넘기는지 적혀 있지 않아요.)");
		});
		out.push("", `> ${FLOW_NOTE}`, "");
	}
	out.push("## 실행 반영 범위 (설계한 내용이 어디에 들어가나)", "", "| 항목 | 반영되는 곳 | 알아 둘 점 |", "| --- | --- | --- |");
	for (const row of reflectionScope(recipe, providers)) out.push(`| ${row.item} | ${cell(row.where)} | ${cell(row.note)} |`);
	out.push("");
	const outputs = deliverableSummary(recipe, true);
	if (outputs || success.length > 0) {
		out.push("## 예상 결과 형식", "", "첫 프롬프트는 마지막에 결과를 이렇게 정리하라고 요청합니다.", "");
		if (outputs) out.push(`- 역할별 산출물: ${outputs}`);
		if (success.length > 0) out.push("- 성공 조건을 하나씩 확인한 결과");
		out.push("- 확인하지 못한 것과 남은 문제", "");
	}
	out.push("## 확인 기록", "");
	const records = recipe.verification ?? [];
	if (records.length === 0) out.push("- 확인 기록이 없습니다. 이 레시피는 실제 도구에서 실행해 확인된 적이 없습니다.");
	for (const record of records) {
		const detail = verificationDetail(record);
		out.push(`- ${verificationLine(record)}${detail ? ` (${detail})` : ""}`);
		out.push(`  - ${record.note ?? KIND_HINTS[record.kind]}`);
	}
	out.push("", "> \"문서 확인\"과 \"파일 생성 확인\"은 실제로 실행해 본 것이 아닙니다. 직접 돌려 본 뒤 결과를 teamcook 편집 화면의 확인 기록에 적어 두세요.", "");
	if (plans && style !== "debate") {
		const resolved = resolveRecipe(recipe, plans, providers);
		out.push("## 내 플랜 기준 실행 경로 (내보낸 시점)", "", `${resolved.summary}`, "");
		for (const card of recipe.cards) {
			const resolution = resolved.perCard[card.id];
			const route = effectiveRoute(resolution);
			const engine = providers.engines[route.engine]?.name ?? route.engine;
			const lock = resolution.locked ? `🔒 ${resolution.lockReason ?? ""} → ` : "";
			out.push(`- ${cardLabel(card)}: ${lock}${PATH_SYMBOLS[route.path]} ${PATH_NAMES[route.path]} — ${engine}`);
			if (resolution.alternative) out.push(`  - ${resolution.alternative.reason}`);
		}
		if (resolved.styleLock) out.push("", `> 🔒 ${resolved.styleLock.reason} ${resolved.styleLock.suggestion}`);
		out.push("", `> ${PLAN_FIT_NOTE} 다른 사람은 플랜이 달라 경로가 다를 수 있어요.`, "");
	}
	if (style === "agent-team") {
		out.push(...agentTeamSections(recipe));
		return out.join("\n");
	}
	if (style === "debate") {
		out.push(...debateSections(recipe));
		return out.join("\n");
	}
	out.push("## 설치 (1분)", "", "1. 이 폴더 안의 `.codex` 폴더와 `.claude` 폴더를 **내 프로젝트 폴더 맨 위**에 복사합니다.", "   - 점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. (Windows 탐색기: 보기 → 숨긴 항목 / macOS Finder: Cmd+Shift+.)", "   - 이미 `.codex/config.toml`이 있다면 덮어쓰지 말고, 이 파일의 `[agents]` 부분만 옮겨 적으세요.", "2. 두 도구 모두에서 팀 전체를 쓸 수 있게, 모든 에이전트를 Codex 형식(`.codex/agents/*.toml`)과 Claude Code 형식(`.claude/agents/*.md`)으로 둘 다 넣어 두었습니다. 쓰지 않는 쪽 폴더는 지워도 됩니다.", ...engines.includes("antigravity-cli") ? ["3. Antigravity를 쓴다면 `.agents` 폴더도 같은 곳에 복사합니다. (`.agents/agents/*.md`, 실행: `agy`)"] : [], ...engines.includes("grok-build") ? ["3. Grok Build를 쓴다면 `.grok` 폴더도 같은 곳에 복사합니다. (`.grok/agents/*.md`, 실행: `grok`, 에이전트 목록: `/agents`)"] : [], "", "## 실행 방법", "", "### 터미널에서 Codex로", "", "```bash", "cd 내-프로젝트-폴더", hasReadOnly ? "codex            # 검토·조사만 할 때는: codex --sandbox read-only" : "codex", "```", "", `확인: \`${recipe.cards[0]?.name ?? "reviewer"} 에이전트에게 이 프로젝트를 한 줄로 요약하게 해 줘\` 라고 입력해 보세요. 실행 중인 에이전트는 \`/subagents\`로 볼 수 있습니다.`, "", "### 터미널에서 Claude Code로", "", "```bash", "cd 내-프로젝트-폴더", "claude", "```", "", `확인: \`어떤 서브에이전트가 있어?\` 라고 물어보세요. 특정 에이전트를 콕 집어 부르려면 \`@agent-${recipe.cards[0]?.name ?? "reviewer"}\` 처럼 씁니다.`, "(`.claude/agents` 폴더를 처음 만든 경우에는 Claude Code를 한 번 껐다 켜야 보입니다.)", "", "### 에이전트가 안 보일 때", "", "- `.codex`와 `.claude` 폴더가 프로젝트 폴더 **맨 위**에 있는지 확인합니다 (하위 폴더에 넣으면 안 보입니다).", "- 도구를 그 프로젝트 폴더에서 실행했는지 확인하고, 파일을 넣은 뒤 도구를 한 번 껐다 켭니다.", "- 파일 이름과 확장자(`.toml`, `.md`)가 바뀌지 않았는지 확인합니다.", "- 도구에 로그인돼 있는지 확인합니다.", "", "### T3 Code · 1Code에서", "", "두 도구는 내 PC에 설치된 Codex·Claude Code를 대신 실행해 주는 화면입니다. 위처럼 파일을 프로젝트 폴더에 넣은 뒤 그 폴더를 프로젝트로 열면 됩니다.", "채팅마다 별도의 git 작업 폴더(worktree)를 만드는 도구에서는, **`.codex`와 `.claude` 폴더를 git에 커밋해 두어야** 에이전트가 보입니다.", "", "### 첫 프롬프트 예시", "", "```text", starterPrompt(recipe), "```", "");
	if (recipe.howToRun) out.push("만든 사람의 실행 팁:", "", `> ${recipe.howToRun.replace(/\r?\n/g, "\n> ")}`, "");
	out.push("## 알아 둘 점", "", "- **Codex의 읽기 전용:** Codex는 에이전트 파일만으로는 읽기 전용을 강제할 수 없습니다(서브에이전트는 메인 세션의 권한을 물려받음). 그래서 읽기 전용 에이전트의 지시문 끝에 \"수정하지 마라\"는 문장을 넣어 두었습니다. 확실히 막으려면 `codex --sandbox read-only`로 실행하세요.", "- **Claude Code의 읽기 전용:** `tools` 목록을 읽기 도구(Read, Grep, Glob)로 제한해 두었습니다.", "- **검토 결과는 주장입니다:** 다른 모델의 지적도 틀릴 수 있습니다. 작성자가 확인한 뒤 맞는 것만 반영하세요.", "- **다시 고치려면:** `recipe.json`을 teamcook 사이트에서 불러오면 이 팀을 그대로 편집할 수 있습니다.", "");
	return out.join("\n");
}
function tipLines(recipe) {
	return recipe.howToRun ? [
		"만든 사람의 실행 팁:",
		"",
		`> ${recipe.howToRun.replace(/\r?\n/g, "\n> ")}`,
		""
	] : [];
}
/** 에이전트 팀 조리법의 설치·실행·확인 방법 (2026-11-16 공식 문서 확인) */
function agentTeamSections(recipe) {
	const info = COLLABORATIONS$1["agent-team"];
	const firstName = recipe.cards[0]?.name ?? "reviewer";
	return [
		"## 설치 (1분)",
		"",
		"1. 이 폴더 안의 `.claude` 폴더를 **내 프로젝트 폴더 맨 위**에 복사합니다.",
		"   - 점(.)으로 시작하는 폴더는 숨김 폴더라 안 보일 수 있어요. (Windows 탐색기: 보기 → 숨긴 항목 / macOS Finder: Cmd+Shift+.)",
		"   - `.claude/agents/*.md`: 팀원 한 명 한 명의 역할 정의입니다.",
		"   - `.claude/settings.json`: 에이전트 팀 기능을 켜는 설정입니다. 내용은 아래 한 가지뿐이에요.",
		"",
		"```json",
		AGENT_TEAMS_SETTINGS_JSON.trimEnd(),
		"```",
		"",
		`2. **${AGENT_TEAMS_MERGE_HINT}**`,
		"",
		"## 실행 방법 (Claude Code 전용)",
		"",
		"```bash",
		"cd 내-프로젝트-폴더",
		"claude",
		"```",
		"",
		"설정 파일을 넣은 뒤에는 Claude Code를 **새로 시작**해야 적용됩니다. 그다음 아래 프롬프트를 붙여 넣고, 맨 아래 \"할 일\"만 바꿔 주세요.",
		"",
		"### 첫 프롬프트 (팀원 소개)",
		"",
		"```text",
		teamPrompt(recipe),
		"```",
		"",
		...tipLines(recipe),
		"## 팀이 제대로 시작됐는지 확인하기",
		"",
		`1. 프롬프트를 보낸 뒤 화면 아래쪽 에이전트 목록에 팀원 ${recipe.cards.length}명의 이름이 보이면 성공입니다.`,
		"2. 위·아래 화살표로 팀원을 고르고 Enter를 누르면 그 팀원의 대화를 볼 수 있고, 바로 말을 걸 수도 있습니다.",
		"3. Ctrl+T를 누르면 팀이 함께 쓰는 할 일 목록이 보입니다.",
		"4. 팀원이 아니라 서브에이전트로 일을 시작했다면 \"서브에이전트 말고 에이전트 팀으로 다시 해 줘\"라고 말하세요.",
		`5. 끝낼 때는 "${firstName} 팀원을 종료해 줘"처럼 말합니다. 대화창을 닫으면 팀은 자동으로 정리됩니다.`,
		"",
		`팀원이 하나도 안 생긴다면: \`.claude/settings.json\`에 \`${AGENT_TEAMS_ENV_NAME}\`가 들어 있는지, Claude Code를 새로 시작했는지 확인하세요. 오래된 Claude Code라면 먼저 업데이트하세요.`,
		"",
		"## 알아 둘 점",
		"",
		...info.notes.map((note) => `- ${note}`),
		"- **읽기 전용 팀원:** `tools` 목록을 읽기 도구(Read, Grep, Glob)로 제한해 두었습니다.",
		"- **Claude Code가 없다면:** teamcook 사이트에서 `recipe.json`을 불러와 조리법을 \"서브에이전트\"로 바꾸면, 같은 역할을 Codex 등 다른 도구용 파일로 내보낼 수 있습니다.",
		`- 공식 문서: ${info.sourceUrl} (${info.lastVerified} 확인)`,
		""
	];
}
/** 토론형 조리법의 실행 방법. 설정 파일이 없고 프롬프트만 있다. */
function debateSections(recipe) {
	return [
		"## 실행 방법 (설치할 것이 없어요)",
		"",
		"1. 아래 프롬프트를 통째로 복사합니다. (같은 내용이 `debate-prompt.txt`에도 들어 있습니다.)",
		"2. 쓰는 AI 채팅에 붙여 넣습니다. ChatGPT·Claude·Gemini 무료 웹 채팅도 되고, Codex·Claude Code 같은 터미널 도구도 됩니다.",
		"3. \"주제:\" 줄만 내가 결정하고 싶은 것으로 바꿔서 보냅니다.",
		"",
		"### 토론 프롬프트",
		"",
		"```text",
		debatePrompt(recipe),
		"```",
		"",
		...tipLines(recipe),
		"## 알아 둘 점",
		"",
		...COLLABORATIONS$1.debate.notes.map((note) => `- ${note}`),
		"- **토론 결과는 주장입니다:** 결론에 쓰인 사실은 직접 확인한 뒤 쓰세요.",
		"- **다시 고치려면:** `recipe.json`을 teamcook 사이트에서 불러오면 역할과 순서를 고칠 수 있습니다.",
		""
	];
}
// src/lib/exportZip.ts
/** 파일·폴더 이름으로 쓸 수 없는 글자를 -로 바꾼다. 한글은 그대로 둔다. */
function safeName(value, fallback) {
	return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || fallback;
}
/** zip에 들어갈 파일들을 { 경로: 내용 }으로 만든다. (테스트하기 쉽게 zip과 분리) */
function buildRecipeFiles(recipe, providers, options = {}) {
	const { plans } = options;
	const engines = exportEngines(recipe, providers, plans);
	const style = collaborationOf(recipe);
	const bridge = style === "subagents" && options.codexBridge === true && needsCodexBridge(recipe);
	const root = safeName(recipe.title, "recipe");
	const files = {};
	const used = /* @__PURE__ */ new Set();
	for (const card of recipe.cards) {
		const base = safeName(card.name, "agent");
		let fileName = base;
		for (let n = 2; used.has(fileName); n += 1) fileName = `${base}-${n}`;
		used.add(fileName);
		if (style === "debate") continue;
		if (style === "agent-team") {
			const { model, ...rest } = card;
			const member = card.preferredEngine === "claude-code" && model ? {
				...rest,
				model
			} : rest;
			files[`${root}/.claude/agents/${fileName}.md`] = cardToClaudeMd({
				...member,
				preferredEngine: "claude-code"
			});
			continue;
		}
		files[`${root}/.codex/agents/${fileName}.toml`] = cardToCodexToml(card);
		files[`${root}/.claude/agents/${fileName}.md`] = bridge && card.preferredEngine === "codex-cli" ? codexBridgeMd(card) : cardToClaudeMd(card);
		if (engines.includes("antigravity-cli")) files[`${root}/.agents/agents/${fileName}.md`] = cardToAntigravityMd(card);
		if (engines.includes("grok-build")) files[`${root}/.grok/agents/${fileName}.md`] = cardToGrokMd(card);
	}
	if (style === "subagents") files[`${root}/.codex/config.toml`] = recipeToCodexConfig(recipe);
	if (style === "agent-team") files[`${root}/.claude/settings.json`] = AGENT_TEAMS_SETTINGS_JSON;
	if (style === "debate") files[`${root}/debate-prompt.txt`] = `${debatePrompt(recipe)}\n`;
	files[`${root}/recipe.json`] = `${JSON.stringify(recipe, null, 2)}\n`;
	files[`${root}/RECIPE.md`] = buildRecipeMd(recipe, providers, plans);
	if (bridge) files[`${root}/RECIPE.md`] += [
		"## Claude Code에서 Codex 자동 호출 (실험적)",
		"",
		"이 zip은 \"Codex 자동 호출\"을 켜고 내보냈습니다. Codex 담당 에이전트의 Claude Code용 파일(`.claude/agents/`)은",
		"직접 일하지 않고 `codex exec` 명령으로 Codex에게 일을 넘긴 뒤 결과를 그대로 전달합니다.",
		"그래서 Claude Code 하나만 열어 두어도 두 회사 모델이 함께 일합니다.",
		"",
		"- Codex CLI가 설치·로그인돼 있어야 합니다 (ChatGPT Plus 이상 또는 API 키).",
		"- 호출할 때마다 Codex 사용량이 듭니다.",
		"- Claude Code가 `codex` 명령 실행 허락을 물으면 허용해 주세요.",
		""
	].join("\n");
	return files;
}
// src/lib/recipeSchema.ts
var import_lz_string = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LZString = (function() {
		var f = String.fromCharCode;
		var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
		var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
		var baseReverseDic = {};
		function getBaseValue(alphabet, character) {
			if (!baseReverseDic[alphabet]) {
				baseReverseDic[alphabet] = {};
				for (var i = 0; i < alphabet.length; i++) baseReverseDic[alphabet][alphabet.charAt(i)] = i;
			}
			return baseReverseDic[alphabet][character];
		}
		var LZString = {
			compressToBase64: function(input) {
				if (input == null) return "";
				var res = LZString._compress(input, 6, function(a) {
					return keyStrBase64.charAt(a);
				});
				switch (res.length % 4) {
					default:
					case 0: return res;
					case 1: return res + "===";
					case 2: return res + "==";
					case 3: return res + "=";
				}
			},
			decompressFromBase64: function(input) {
				if (input == null) return "";
				if (input == "") return null;
				return LZString._decompress(input.length, 32, function(index) {
					return getBaseValue(keyStrBase64, input.charAt(index));
				});
			},
			compressToUTF16: function(input) {
				if (input == null) return "";
				return LZString._compress(input, 15, function(a) {
					return f(a + 32);
				}) + " ";
			},
			decompressFromUTF16: function(compressed) {
				if (compressed == null) return "";
				if (compressed == "") return null;
				return LZString._decompress(compressed.length, 16384, function(index) {
					return compressed.charCodeAt(index) - 32;
				});
			},
			compressToUint8Array: function(uncompressed) {
				var compressed = LZString.compress(uncompressed);
				var buf = new Uint8Array(compressed.length * 2);
				for (var i = 0, TotalLen = compressed.length; i < TotalLen; i++) {
					var current_value = compressed.charCodeAt(i);
					buf[i * 2] = current_value >>> 8;
					buf[i * 2 + 1] = current_value % 256;
				}
				return buf;
			},
			decompressFromUint8Array: function(compressed) {
				if (compressed === null || compressed === void 0) return LZString.decompress(compressed);
				else {
					var buf = new Array(compressed.length / 2);
					for (var i = 0, TotalLen = buf.length; i < TotalLen; i++) buf[i] = compressed[i * 2] * 256 + compressed[i * 2 + 1];
					var result = [];
					buf.forEach(function(c) {
						result.push(f(c));
					});
					return LZString.decompress(result.join(""));
				}
			},
			compressToEncodedURIComponent: function(input) {
				if (input == null) return "";
				return LZString._compress(input, 6, function(a) {
					return keyStrUriSafe.charAt(a);
				});
			},
			decompressFromEncodedURIComponent: function(input) {
				if (input == null) return "";
				if (input == "") return null;
				input = input.replace(/ /g, "+");
				return LZString._decompress(input.length, 32, function(index) {
					return getBaseValue(keyStrUriSafe, input.charAt(index));
				});
			},
			compress: function(uncompressed) {
				return LZString._compress(uncompressed, 16, function(a) {
					return f(a);
				});
			},
			_compress: function(uncompressed, bitsPerChar, getCharFromInt) {
				if (uncompressed == null) return "";
				var i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = "", context_wc = "", context_w = "", context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2, context_data = [], context_data_val = 0, context_data_position = 0, ii = 0;
				for (; ii < uncompressed.length; ii += 1) {
					context_c = uncompressed.charAt(ii);
					if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
						context_dictionary[context_c] = context_dictSize++;
						context_dictionaryToCreate[context_c] = true;
					}
					context_wc = context_w + context_c;
					if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) context_w = context_wc;
					else {
						if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
							if (context_w.charCodeAt(0) < 256) {
								for (i = 0; i < context_numBits; i++) {
									context_data_val = context_data_val << 1;
									if (context_data_position == bitsPerChar - 1) {
										context_data_position = 0;
										context_data.push(getCharFromInt(context_data_val));
										context_data_val = 0;
									} else context_data_position++;
								}
								value = context_w.charCodeAt(0);
								for (i = 0; i < 8; i++) {
									context_data_val = context_data_val << 1 | value & 1;
									if (context_data_position == bitsPerChar - 1) {
										context_data_position = 0;
										context_data.push(getCharFromInt(context_data_val));
										context_data_val = 0;
									} else context_data_position++;
									value = value >> 1;
								}
							} else {
								value = 1;
								for (i = 0; i < context_numBits; i++) {
									context_data_val = context_data_val << 1 | value;
									if (context_data_position == bitsPerChar - 1) {
										context_data_position = 0;
										context_data.push(getCharFromInt(context_data_val));
										context_data_val = 0;
									} else context_data_position++;
									value = 0;
								}
								value = context_w.charCodeAt(0);
								for (i = 0; i < 16; i++) {
									context_data_val = context_data_val << 1 | value & 1;
									if (context_data_position == bitsPerChar - 1) {
										context_data_position = 0;
										context_data.push(getCharFromInt(context_data_val));
										context_data_val = 0;
									} else context_data_position++;
									value = value >> 1;
								}
							}
							context_enlargeIn--;
							if (context_enlargeIn == 0) {
								context_enlargeIn = Math.pow(2, context_numBits);
								context_numBits++;
							}
							delete context_dictionaryToCreate[context_w];
						} else {
							value = context_dictionary[context_w];
							for (i = 0; i < context_numBits; i++) {
								context_data_val = context_data_val << 1 | value & 1;
								if (context_data_position == bitsPerChar - 1) {
									context_data_position = 0;
									context_data.push(getCharFromInt(context_data_val));
									context_data_val = 0;
								} else context_data_position++;
								value = value >> 1;
							}
						}
						context_enlargeIn--;
						if (context_enlargeIn == 0) {
							context_enlargeIn = Math.pow(2, context_numBits);
							context_numBits++;
						}
						context_dictionary[context_wc] = context_dictSize++;
						context_w = String(context_c);
					}
				}
				if (context_w !== "") {
					if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
						if (context_w.charCodeAt(0) < 256) {
							for (i = 0; i < context_numBits; i++) {
								context_data_val = context_data_val << 1;
								if (context_data_position == bitsPerChar - 1) {
									context_data_position = 0;
									context_data.push(getCharFromInt(context_data_val));
									context_data_val = 0;
								} else context_data_position++;
							}
							value = context_w.charCodeAt(0);
							for (i = 0; i < 8; i++) {
								context_data_val = context_data_val << 1 | value & 1;
								if (context_data_position == bitsPerChar - 1) {
									context_data_position = 0;
									context_data.push(getCharFromInt(context_data_val));
									context_data_val = 0;
								} else context_data_position++;
								value = value >> 1;
							}
						} else {
							value = 1;
							for (i = 0; i < context_numBits; i++) {
								context_data_val = context_data_val << 1 | value;
								if (context_data_position == bitsPerChar - 1) {
									context_data_position = 0;
									context_data.push(getCharFromInt(context_data_val));
									context_data_val = 0;
								} else context_data_position++;
								value = 0;
							}
							value = context_w.charCodeAt(0);
							for (i = 0; i < 16; i++) {
								context_data_val = context_data_val << 1 | value & 1;
								if (context_data_position == bitsPerChar - 1) {
									context_data_position = 0;
									context_data.push(getCharFromInt(context_data_val));
									context_data_val = 0;
								} else context_data_position++;
								value = value >> 1;
							}
						}
						context_enlargeIn--;
						if (context_enlargeIn == 0) {
							context_enlargeIn = Math.pow(2, context_numBits);
							context_numBits++;
						}
						delete context_dictionaryToCreate[context_w];
					} else {
						value = context_dictionary[context_w];
						for (i = 0; i < context_numBits; i++) {
							context_data_val = context_data_val << 1 | value & 1;
							if (context_data_position == bitsPerChar - 1) {
								context_data_position = 0;
								context_data.push(getCharFromInt(context_data_val));
								context_data_val = 0;
							} else context_data_position++;
							value = value >> 1;
						}
					}
					context_enlargeIn--;
					if (context_enlargeIn == 0) {
						context_enlargeIn = Math.pow(2, context_numBits);
						context_numBits++;
					}
				}
				value = 2;
				for (i = 0; i < context_numBits; i++) {
					context_data_val = context_data_val << 1 | value & 1;
					if (context_data_position == bitsPerChar - 1) {
						context_data_position = 0;
						context_data.push(getCharFromInt(context_data_val));
						context_data_val = 0;
					} else context_data_position++;
					value = value >> 1;
				}
				while (true) {
					context_data_val = context_data_val << 1;
					if (context_data_position == bitsPerChar - 1) {
						context_data.push(getCharFromInt(context_data_val));
						break;
					} else context_data_position++;
				}
				return context_data.join("");
			},
			decompress: function(compressed) {
				if (compressed == null) return "";
				if (compressed == "") return null;
				return LZString._decompress(compressed.length, 32768, function(index) {
					return compressed.charCodeAt(index);
				});
			},
			_decompress: function(length, resetValue, getNextValue) {
				var dictionary = [], enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c, data = {
					val: getNextValue(0),
					position: resetValue,
					index: 1
				};
				for (i = 0; i < 3; i += 1) dictionary[i] = i;
				bits = 0;
				maxpower = Math.pow(2, 2);
				power = 1;
				while (power != maxpower) {
					resb = data.val & data.position;
					data.position >>= 1;
					if (data.position == 0) {
						data.position = resetValue;
						data.val = getNextValue(data.index++);
					}
					bits |= (resb > 0 ? 1 : 0) * power;
					power <<= 1;
				}
				switch (bits) {
					case 0:
						bits = 0;
						maxpower = Math.pow(2, 8);
						power = 1;
						while (power != maxpower) {
							resb = data.val & data.position;
							data.position >>= 1;
							if (data.position == 0) {
								data.position = resetValue;
								data.val = getNextValue(data.index++);
							}
							bits |= (resb > 0 ? 1 : 0) * power;
							power <<= 1;
						}
						c = f(bits);
						break;
					case 1:
						bits = 0;
						maxpower = Math.pow(2, 16);
						power = 1;
						while (power != maxpower) {
							resb = data.val & data.position;
							data.position >>= 1;
							if (data.position == 0) {
								data.position = resetValue;
								data.val = getNextValue(data.index++);
							}
							bits |= (resb > 0 ? 1 : 0) * power;
							power <<= 1;
						}
						c = f(bits);
						break;
					case 2: return "";
				}
				dictionary[3] = c;
				w = c;
				result.push(c);
				while (true) {
					if (data.index > length) return "";
					bits = 0;
					maxpower = Math.pow(2, numBits);
					power = 1;
					while (power != maxpower) {
						resb = data.val & data.position;
						data.position >>= 1;
						if (data.position == 0) {
							data.position = resetValue;
							data.val = getNextValue(data.index++);
						}
						bits |= (resb > 0 ? 1 : 0) * power;
						power <<= 1;
					}
					switch (c = bits) {
						case 0:
							bits = 0;
							maxpower = Math.pow(2, 8);
							power = 1;
							while (power != maxpower) {
								resb = data.val & data.position;
								data.position >>= 1;
								if (data.position == 0) {
									data.position = resetValue;
									data.val = getNextValue(data.index++);
								}
								bits |= (resb > 0 ? 1 : 0) * power;
								power <<= 1;
							}
							dictionary[dictSize++] = f(bits);
							c = dictSize - 1;
							enlargeIn--;
							break;
						case 1:
							bits = 0;
							maxpower = Math.pow(2, 16);
							power = 1;
							while (power != maxpower) {
								resb = data.val & data.position;
								data.position >>= 1;
								if (data.position == 0) {
									data.position = resetValue;
									data.val = getNextValue(data.index++);
								}
								bits |= (resb > 0 ? 1 : 0) * power;
								power <<= 1;
							}
							dictionary[dictSize++] = f(bits);
							c = dictSize - 1;
							enlargeIn--;
							break;
						case 2: return result.join("");
					}
					if (enlargeIn == 0) {
						enlargeIn = Math.pow(2, numBits);
						numBits++;
					}
					if (dictionary[c]) entry = dictionary[c];
					else if (c === dictSize) entry = w + w.charAt(0);
					else return null;
					result.push(entry);
					dictionary[dictSize++] = w + entry.charAt(0);
					enlargeIn--;
					w = entry;
					if (enlargeIn == 0) {
						enlargeIn = Math.pow(2, numBits);
						numBits++;
					}
				}
			}
		};
		return LZString;
	})();
	if (typeof define === "function" && define.amd) define(function() {
		return LZString;
	});
	else if (typeof module !== "undefined" && module != null) module.exports = LZString;
	else if (typeof angular !== "undefined" && angular != null) angular.module("LZString", []).factory("LZString", function() {
		return LZString;
	});
})))();
var RecipeFormatError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "RecipeFormatError";
	}
};
var ENGINES = [
	"codex-cli",
	"claude-code",
	"antigravity-cli",
	"grok-build",
	"api",
	"manual"
];
var PERMISSIONS = [
	"read-only",
	"edit",
	"full"
];
var COLLABORATIONS = [
	"subagents",
	"agent-team",
	"debate"
];
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var KINDS = [
	"docs",
	"file",
	"run",
	"unclassified"
];
var RESULTS = [
	"success",
	"failure",
	"n/a"
];
var SOURCES = [
	"user",
	"auto",
	"author",
	"unknown"
];
/** 옛 형식(v1)의 확인 날짜를 옮긴 기록의 id. 고정이라 두 번 옮겨도 하나만 생긴다. */
var LEGACY_VERIFICATION_ID = "legacy-date";
var MAX_ITEMS = 30;
var MAX_LINE = 1e3;
var MAX_CARDS = 30;
var MAX_HANDOFFS = 100;
var MAX_SHORT = 300;
var MAX_LONG = 2e4;
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value, max, fallback = "") {
	return typeof value === "string" ? value.slice(0, max) : fallback;
}
function stringList(value, maxItems) {
	if (!Array.isArray(value)) return void 0;
	const list = value.filter((item) => typeof item === "string").slice(0, maxItems).map((item) => item.slice(0, MAX_SHORT));
	return list.length > 0 ? list : void 0;
}
/** 여러 줄 목록 (성공 조건, 완료 기준 등). 빈 줄은 버린다. */
function lineList(value) {
	if (!Array.isArray(value)) return void 0;
	const list = value.filter((item) => typeof item === "string").map((item) => item.slice(0, MAX_LINE)).filter((item) => item.trim() !== "").slice(0, MAX_ITEMS);
	return list.length > 0 ? list : void 0;
}
function parseDeliverables(value) {
	if (!Array.isArray(value)) return void 0;
	const used = /* @__PURE__ */ new Set();
	const list = [];
	for (const item of value.slice(0, MAX_ITEMS)) {
		if (!isObject(item)) continue;
		const name = text(item.name, MAX_SHORT);
		if (name.trim() === "") continue;
		let id = text(item.id, MAX_SHORT);
		if (!id || used.has(id)) id = newId("out");
		used.add(id);
		const deliverable = {
			id,
			name
		};
		const description = text(item.description, MAX_LINE);
		if (description) deliverable.description = description;
		list.push(deliverable);
	}
	return list.length > 0 ? list : void 0;
}
function parseVerification(value) {
	if (!Array.isArray(value)) return [];
	const used = /* @__PURE__ */ new Set();
	const list = [];
	for (const item of value.slice(0, MAX_ITEMS)) {
		if (!isObject(item)) continue;
		if (typeof item.checkedAt !== "string" || !DATE_PATTERN.test(item.checkedAt)) continue;
		let id = text(item.id, MAX_SHORT);
		if (!id || used.has(id)) id = newId("check");
		used.add(id);
		const record = {
			id,
			kind: KINDS.includes(item.kind) ? item.kind : "unclassified",
			checkedAt: item.checkedAt,
			result: RESULTS.includes(item.result) ? item.result : "n/a",
			source: SOURCES.includes(item.source) ? item.source : "unknown"
		};
		for (const key of [
			"tool",
			"toolVersion",
			"environment"
		]) {
			const field = text(item[key], MAX_SHORT);
			if (field) record[key] = field;
		}
		const note = text(item.note, MAX_LINE);
		if (note) record.note = note;
		list.push(record);
	}
	return list;
}
function wholeNumber(value, fallback, min, max) {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}
function parseExtra(value) {
	if (!isObject(value)) return void 0;
	const extra = {};
	if (isObject(value.codex)) extra.codex = value.codex;
	if (isObject(value.claude)) extra.claude = value.claude;
	if (isObject(value.antigravity)) extra.antigravity = value.antigravity;
	if (isObject(value.grok)) extra.grok = value.grok;
	return Object.keys(extra).length > 0 ? extra : void 0;
}
function parseCard(value, usedIds) {
	if (!isObject(value)) return null;
	const name = text(value.name, MAX_SHORT).trim();
	if (!name) return null;
	let id = text(value.id, MAX_SHORT);
	if (!id || usedIds.has(id)) id = newId("card");
	usedIds.add(id);
	const card = {
		id,
		name,
		displayName: text(value.displayName, MAX_SHORT) || name,
		role: text(value.role, MAX_LONG),
		instructions: text(value.instructions, MAX_LONG),
		preferredEngine: ENGINES.includes(value.preferredEngine) ? value.preferredEngine : "codex-cli",
		permission: PERMISSIONS.includes(value.permission) ? value.permission : "full"
	};
	const model = text(value.model, MAX_SHORT);
	if (model) card.model = model;
	const tools = stringList(value.tools, 50);
	if (tools) card.tools = tools;
	const tags = stringList(value.tags, 10);
	if (tags) card.tags = tags;
	const requiredInputs = lineList(value.requiredInputs);
	if (requiredInputs) card.requiredInputs = requiredInputs;
	const deliverables = parseDeliverables(value.deliverables);
	if (deliverables) card.deliverables = deliverables;
	const completionCriteria = lineList(value.completionCriteria);
	if (completionCriteria) card.completionCriteria = completionCriteria;
	const boundaries = lineList(value.boundaries);
	if (boundaries) card.boundaries = boundaries;
	const extra = parseExtra(value.extra);
	if (extra) card.extra = extra;
	return card;
}
/**
* 알 수 없는 값을 Recipe로 바꾼다. 형식이 맞지 않으면 RecipeFormatError를 던진다.
*
* 하위 호환 (옛 버전 → 지금 버전). 여러 번 적용해도 결과가 같다.
* - v1 → v2: 확인 날짜(lastVerified)를 '확인 방식 미기록' 기록 하나로 옮긴다. 날짜는 그대로 두고,
*   실제 실행에 성공했다는 기록으로 올리지 않는다. 새로 생긴 항목(학습 목표, 산출물 등)은 비워 둔다.
* - 더 새로운 버전은 읽지 않고 거절한다 (모르는 항목을 조용히 버리지 않으려고).
*/
function parseRecipe(raw) {
	if (!isObject(raw)) throw new RecipeFormatError("레시피 데이터가 아니에요.");
	const version = raw.schemaVersion;
	if (typeof version !== "number") throw new RecipeFormatError("레시피 형식 버전(schemaVersion)이 없어요.");
	if (version > 2) throw new RecipeFormatError("이 레시피는 더 새로운 버전에서 만들어졌어요. 페이지를 새로고침한 뒤 다시 열어 보세요.");
	if (version < 1) throw new RecipeFormatError("알 수 없는 레시피 형식 버전이에요.");
	if (!Array.isArray(raw.cards)) throw new RecipeFormatError("레시피에 카드 목록이 없어요.");
	const usedIds = /* @__PURE__ */ new Set();
	const cards = raw.cards.slice(0, MAX_CARDS).map((item) => parseCard(item, usedIds)).filter((card) => card !== null);
	const handoffs = [];
	if (Array.isArray(raw.handoffs)) for (const item of raw.handoffs.slice(0, MAX_HANDOFFS)) {
		if (!isObject(item)) continue;
		const from = text(item.from, MAX_SHORT);
		const to = text(item.to, MAX_SHORT);
		if (!usedIds.has(from) || !usedIds.has(to)) continue;
		const handoff = {
			id: text(item.id, MAX_SHORT) || newId("handoff"),
			from,
			to
		};
		const label = text(item.label, MAX_SHORT);
		if (label) handoff.label = label;
		const deliverableIds = stringList(item.deliverableIds, MAX_ITEMS);
		if (deliverableIds) handoff.deliverableIds = deliverableIds;
		handoffs.push(handoff);
	}
	const settings = isObject(raw.settings) ? raw.settings : {};
	const recipe = {
		schemaVersion: 2,
		id: text(raw.id, MAX_SHORT) || newId("recipe"),
		title: text(raw.title, MAX_SHORT).trim() || "이름 없는 레시피",
		summary: text(raw.summary, MAX_LONG),
		useCase: text(raw.useCase, MAX_SHORT),
		cards,
		handoffs,
		settings: {
			maxThreads: wholeNumber(settings.maxThreads, 3, 1, 20),
			maxDepth: wholeNumber(settings.maxDepth, 1, 1, 5)
		}
	};
	if (raw.collaboration !== void 0) recipe.collaboration = COLLABORATIONS.includes(raw.collaboration) ? raw.collaboration : "subagents";
	const learningObjective = text(raw.learningObjective, MAX_LINE);
	if (learningObjective) recipe.learningObjective = learningObjective;
	const sampleTask = text(raw.sampleTask, MAX_LONG);
	if (sampleTask) recipe.sampleTask = sampleTask;
	const successCriteria = lineList(raw.successCriteria);
	if (successCriteria) recipe.successCriteria = successCriteria;
	const prerequisites = lineList(raw.prerequisites);
	if (prerequisites) recipe.prerequisites = prerequisites;
	const verification = parseVerification(raw.verification);
	if (typeof raw.lastVerified === "string" && DATE_PATTERN.test(raw.lastVerified) && !verification.some((record) => record.id === "legacy-date")) verification.push({
		id: LEGACY_VERIFICATION_ID,
		kind: "unclassified",
		checkedAt: raw.lastVerified,
		result: "n/a",
		source: "unknown"
	});
	if (verification.length > 0) recipe.verification = verification;
	const author = text(raw.author, MAX_SHORT);
	if (author) recipe.author = author;
	const howToRun = text(raw.howToRun, MAX_LONG);
	if (howToRun) recipe.howToRun = howToRun;
	return recipe;
}
/** 압축 문자열 → 레시피. 실패하면 사용자에게 보여 줄 오류 문장을 돌려준다. */
function decodeRecipe(encoded) {
	const broken = "공유 링크가 손상됐거나 끝까지 복사되지 않았어요. 링크를 다시 받아 보세요.";
	if (!encoded) return {
		ok: false,
		error: broken
	};
	let json = null;
	try {
		json = (0, import_lz_string.decompressFromEncodedURIComponent)(encoded);
	} catch {
		json = null;
	}
	if (!json) return {
		ok: false,
		error: broken
	};
	let raw;
	try {
		raw = JSON.parse(json);
	} catch {
		return {
			ok: false,
			error: broken
		};
	}
	try {
		return {
			ok: true,
			recipe: parseRecipe(raw)
		};
	} catch (error) {
		if (error instanceof RecipeFormatError) return {
			ok: false,
			error: error.message
		};
		return {
			ok: false,
			error: broken
		};
	}
}
/** 주소의 hash('#r=...')에서 압축 문자열을 꺼낸다. 공유 링크가 아니면 null. */
function readShareHash(hash) {
	const prefix = `#r=`;
	if (!hash.startsWith(prefix)) return null;
	return hash.slice(prefix.length);
}
// src/cli/install.ts
/** --force여도 덮어쓰지 않는 파일과, 그때 보여 줄 안내 */
var PROTECTED_FILES = {
	".codex/config.toml": "이미 있는 .codex/config.toml은 덮어쓰지 않아요. [agents] 부분만 직접 옮겨 적으세요.",
	".claude/settings.json": AGENT_TEAMS_MERGE_HINT
};
/** 공유 링크(또는 # 뒤 문자열)에서 레시피를 꺼낸다. */
function recipeFromLink(link) {
	const trimmed = link.trim();
	const hashIndex = trimmed.indexOf("#");
	const encoded = hashIndex >= 0 ? readShareHash(trimmed.slice(hashIndex)) : trimmed.replace(/^r=/, "");
	if (!encoded) return {
		ok: false,
		error: "teamcook 공유 링크가 아니에요. 주소에 #r= 이 들어 있어야 해요."
	};
	return decodeRecipe(encoded);
}
/** 링크의 레시피를 프로젝트에 설치할 때 쓸 파일 목록을 만든다. */
function planInstall(link, options = {}) {
	const decoded = recipeFromLink(link);
	if (!decoded.ok) return decoded;
	const { recipe } = decoded;
	const exported = buildRecipeFiles(recipe, providerData, { codexBridge: options.codexBridge });
	const folder = `.teamcook/${safeName(recipe.title, "recipe")}`;
	const files = [];
	for (const [fullPath, content] of Object.entries(exported)) {
		const relative = fullPath.slice(fullPath.indexOf("/") + 1);
		if (!relative.startsWith(".")) files.push({
			path: `${folder}/${relative}`,
			content,
			neverOverwrite: false
		});
		else {
			const mergeHint = PROTECTED_FILES[relative];
			files.push(mergeHint ? {
				path: relative,
				content,
				neverOverwrite: true,
				mergeHint
			} : {
				path: relative,
				content,
				neverOverwrite: false
			});
		}
	}
	return {
		ok: true,
		recipe,
		files
	};
}
// src/cli/local/discover.ts
/** 이 Node에 압축 풀기(zstd)가 들어 있는가 (Node 22.15·23.8부터) */
var zstdSupported = () => typeof zlib.createZstdDecompress === "function";
function openLogStream(file) {
	const raw = createReadStream(file);
	if (!file.endsWith(".zst")) return raw;
	const unzip = zlib.createZstdDecompress();
	raw.on("error", (error) => unzip.destroy(error));
	return raw.pipe(unzip);
}
/** 앞에서부터 줄을 읽다가 pick이 값을 돌려주면 멈춘다 */
async function firstMatch(file, maxLines, pick) {
	let stream;
	try {
		stream = openLogStream(file);
	} catch {
		return;
	}
	const lines = createInterface({
		input: stream,
		crlfDelay: Infinity
	});
	let count = 0;
	try {
		for await (const line of lines) {
			count += 1;
			if (count > maxLines) break;
			try {
				const found = pick(JSON.parse(line));
				if (found !== void 0) return found;
			} catch {}
		}
	} catch {
		return;
	} finally {
		lines.close();
		stream.destroy();
	}
}
var keyOf = (dir) => path.resolve(dir).replace(/[\\/]+$/, "").toLowerCase();
async function safeDirents(dir) {
	try {
		return await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
}
async function claudeHits(projectsDir) {
	const hits = [];
	for (const entry of await safeDirents(projectsDir)) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(projectsDir, entry.name);
		const files = [];
		for (const child of await safeDirents(dir)) {
			if (!child.isFile() || !child.name.endsWith(".jsonl")) continue;
			try {
				files.push({
					file: path.join(dir, child.name),
					mtime: (await stat(path.join(dir, child.name))).mtimeMs
				});
			} catch {}
		}
		files.sort((a, b) => b.mtime - a.mtime);
		let cwd;
		for (const item of files.slice(0, 3)) {
			cwd = await firstMatch(item.file, 60, (line) => typeof line.cwd === "string" ? line.cwd : void 0);
			if (cwd) break;
		}
		if (!cwd) continue;
		for (const item of files) hits.push({
			cwd,
			mtime: item.mtime,
			tool: "claude"
		});
	}
	return hits;
}
async function codexFiles(dir, depth, out) {
	for (const entry of await safeDirents(dir)) {
		const full = path.join(dir, entry.name);
		if (entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".jsonl.zst") && zstdSupported())) out.push(full);
		else if (entry.isDirectory() && depth > 0) await codexFiles(full, depth - 1, out);
	}
}
async function codexHits(sessionsDir, limit) {
	const files = [];
	await codexFiles(sessionsDir, 3, files);
	files.sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
	const hits = [];
	for (const file of files.slice(0, limit)) {
		const meta = await firstMatch(file, 3, (line) => {
			if (line.type !== "session_meta") return void 0;
			const payload = line.payload ?? {};
			return {
				cwd: typeof payload.cwd === "string" ? payload.cwd : "",
				child: Boolean(payload.parent_thread_id)
			};
		});
		if (!meta?.cwd || meta.child) continue;
		try {
			hits.push({
				cwd: meta.cwd,
				mtime: statSync(file).mtimeMs,
				tool: "codex"
			});
		} catch {}
	}
	return hits;
}
/** 두 도구의 기록을 합쳐 최근 프로젝트 목록을 만든다 */
async function discoverProjects(claudeProjects, codexSessions, options = {}) {
	const hits = [...await claudeHits(claudeProjects), ...await codexHits(codexSessions, options.codexFiles ?? 400)];
	const byPath = /* @__PURE__ */ new Map();
	for (const hit of hits) {
		const key = keyOf(hit.cwd);
		let item = byPath.get(key);
		if (!item) {
			const resolved = path.resolve(hit.cwd);
			item = {
				path: resolved,
				name: path.basename(resolved) || resolved,
				lastUsed: 0,
				claudeSessions: 0,
				codexSessions: 0,
				exists: false
			};
			byPath.set(key, item);
		}
		item.lastUsed = Math.max(item.lastUsed, hit.mtime);
		if (hit.tool === "claude") item.claudeSessions += 1;
		else item.codexSessions += 1;
	}
	const list = [...byPath.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, options.limit ?? 30);
	for (const item of list) try {
		item.exists = existsSync(item.path) && statSync(item.path).isDirectory();
	} catch {
		item.exists = false;
	}
	return list;
}
// src/cli/local/policy.ts
var ROOT_IDS = [
	"project",
	"claude-logs",
	"codex-logs"
];
var AGENT_DIRS = [[".claude", "agents"], [".codex", "agents"]];
var DOCS_DIR = [".teamcook"];
/** 읽기만 하는 설정 파일 (없을 때 새로 만드는 것만 허락) */
var CONFIG_FILES = [[".codex", "config.toml"], [".claude", "settings.json"]];
/** 'a/b/c'를 조각으로. 위로 올라가기(..)·드라이브·역슬래시 같은 수상한 경로는 null. */
function splitPath(rel) {
	if (rel.length > 1024) return null;
	const parts = rel.split("/").filter((part) => part !== "");
	for (const part of parts) if (part === "." || part === ".." || /[\\:\0]/.test(part)) return null;
	return parts;
}
var startsWith = (parts, prefix) => prefix.every((name, index) => parts[index] === name);
var equals = (parts, other) => parts.length === other.length && startsWith(parts, other);
/** 로그 파일 이름 (Codex는 오래된 기록을 .zst로 압축한다) */
var isLogFile = (root, name) => root === "codex-logs" ? name.endsWith(".jsonl") || name.endsWith(".jsonl.zst") : root === "claude-logs" && name.endsWith(".jsonl");
/** 폴더로서 들어가거나 목록을 볼 수 있는가 */
function canOpenDir(root, parts) {
	if (root !== "project") return true;
	if (parts.length === 0) return true;
	if (parts.length === 1 && (parts[0] === ".claude" || parts[0] === ".codex")) return true;
	return [...AGENT_DIRS, DOCS_DIR].some((prefix) => startsWith(parts, prefix));
}
/** 파일을 읽을 수 있는가 */
function canReadFile(root, parts) {
	if (parts.length === 0) return false;
	const name = parts[parts.length - 1];
	if (root !== "project") return isLogFile(root, name);
	if (CONFIG_FILES.some((file) => equals(parts, file))) return true;
	if (AGENT_DIRS.some((prefix) => startsWith(parts, prefix))) return parts.length === 3;
	return startsWith(parts, DOCS_DIR) && parts.length >= 2;
}
/** 목록에 보여 줄 항목인가 (보이지 않는 것은 이름도 알려 주지 않는다) */
function canSee(root, parent, name, kind) {
	const parts = [...parent, name];
	if (kind === "directory") {
		if (root !== "project") return true;
		return [...AGENT_DIRS, DOCS_DIR].some((prefix) => startsWith(parts, prefix) || startsWith(prefix, parts));
	}
	return canReadFile(root, parts);
}
/** 파일을 쓸 수 있는가. 설정 파일은 아직 없을 때만 (새로 만들기). */
function canWrite(root, parts, exists) {
	if (root !== "project" || parts.length < 2) return false;
	if (CONFIG_FILES.some((file) => equals(parts, file))) return !exists;
	if (AGENT_DIRS.some((prefix) => startsWith(parts, prefix))) return parts.length === 3;
	return startsWith(parts, DOCS_DIR);
}
/** 파일을 지울 수 있는가. 역할 파일만 (팀에서 빼기). */
function canRemove(root, parts) {
	return root === "project" && parts.length === 3 && AGENT_DIRS.some((prefix) => startsWith(parts, prefix));
}
// src/cli/local/server.ts
var MAX_WRITE = 2097152;
var TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".txt": "text/plain; charset=utf-8"
};
var HttpError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
function send(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(body));
}
async function readBody(req, limit = MAX_WRITE) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > limit) throw new HttpError(413, "파일이 너무 커요 (2MB까지).");
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function sameKey(given, key) {
	if (!given) return false;
	const a = Buffer.from(given);
	const b = Buffer.from(key);
	return a.length === b.length && timingSafeEqual(a, b);
}
/** 심볼릭 링크 등으로 기준 폴더 밖을 가리키면 거절한다 */
async function staysInside(base, full) {
	let probe = full;
	while (!existsSync(probe)) {
		const parent = path.dirname(probe);
		if (parent === probe) return false;
		probe = parent;
	}
	try {
		const [real, realBase] = await Promise.all([realpath(probe), realpath(base)]);
		return real === realBase || real.startsWith(realBase + path.sep);
	} catch {
		return false;
	}
}
async function startLocalServer(options) {
	const key = options.key ?? randomBytes(24).toString("hex");
	let project = null;
	let port = options.port;
	let recentCache = null;
	const zstd = zstdSupported();
	const baseOf = (root) => {
		if (root === "claude-logs") return options.claudeProjects;
		if (root === "codex-logs") return options.codexSessions;
		if (!project) throw new HttpError(409, "아직 연 프로젝트가 없어요.");
		return project.path;
	};
	const target = async (url) => {
		const root = url.searchParams.get("root");
		if (!ROOT_IDS.includes(root)) throw new HttpError(400, "알 수 없는 폴더예요.");
		const parts = splitPath(url.searchParams.get("path") ?? "");
		if (!parts) throw new HttpError(400, "이상한 경로예요.");
		const base = baseOf(root);
		const full = path.join(base, ...parts);
		if (!await staysInside(base, full)) throw new HttpError(403, "이 폴더 밖은 열지 않아요.");
		return {
			root,
			parts,
			base,
			full
		};
	};
	/** Codex의 압축 기록은 .zst를 뗀 이름으로 보여 주고, 읽을 때 풀어 준다 */
	const logFileOf = (root, full) => {
		if (root === "codex-logs" && zstd && !existsSync(full) && existsSync(`${full}.zst`)) return `${full}.zst`;
		return full;
	};
	const statOf = async (root, parts, full) => {
		const real = logFileOf(root, full);
		let info;
		try {
			info = await stat(real);
		} catch {
			throw new HttpError(404, "없어요.");
		}
		if (info.isDirectory()) {
			if (!canOpenDir(root, parts)) throw new HttpError(403, "이 폴더는 열지 않아요.");
			return {
				kind: "directory",
				size: 0,
				mtime: info.mtimeMs
			};
		}
		if (!info.isFile() || !canReadFile(root, parts)) throw new HttpError(403, "이 파일은 읽지 않아요.");
		return {
			kind: "file",
			size: info.size,
			mtime: info.mtimeMs
		};
	};
	/** 역할 파일들의 이름·수정 시각·크기. 이게 바뀌면 밖에서 고친 것이다. */
	let signature = null;
	const agentSignature = async (dir) => {
		const parts = [dir];
		for (const rel of [".claude/agents", ".codex/agents"]) try {
			for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
				if (!entry.isFile()) continue;
				const info = await stat(path.join(dir, rel, entry.name));
				parts.push(`${rel}/${entry.name}:${info.mtimeMs}:${info.size}`);
			}
		} catch {}
		return parts.join("|");
	};
	const listeners = /* @__PURE__ */ new Set();
	const pending = /* @__PURE__ */ new Map();
	let flushTimer = null;
	const queue = (root, rel) => {
		if (!pending.has(root)) pending.set(root, /* @__PURE__ */ new Set());
		pending.get(root).add(rel);
		flushTimer ??= setTimeout(() => {
			flushTimer = null;
			for (const [id, files] of pending) {
				const data = `data: ${JSON.stringify({
					root: id,
					files: [...files].slice(0, 50)
				})}\n\n`;
				for (const res of listeners) res.write(data);
			}
			pending.clear();
		}, 400);
	};
	const watchers = [];
	const timers = [];
	if (options.watch !== false) {
		for (const root of ["claude-logs", "codex-logs"]) {
			const dir = baseOf(root);
			if (!existsSync(dir)) continue;
			try {
				watchers.push(watch(dir, { recursive: true }, (_event, filename) => {
					if (!filename) return;
					const rel = filename.toString().split(path.sep).join("/");
					const name = rel.split("/").pop() ?? "";
					if (isLogFile(root, name)) queue(root, rel.replace(/\.zst$/, ""));
				}));
			} catch {}
		}
		timers.push(setInterval(async () => {
			if (!project) return;
			const next = await agentSignature(project.path);
			if (project && signature !== null && next !== signature) queue("project", "agents");
			signature = next;
		}, 1500));
		timers.push(setInterval(() => listeners.forEach((res) => res.write(": still here\n\n")), 25e3));
	}
	const api = async (req, res, url) => {
		const route = `${req.method} ${url.pathname}`;
		if (route === "GET /api/events") {
			res.writeHead(200, {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-store",
				connection: "keep-alive"
			});
			res.write(": hello\n\n");
			listeners.add(res);
			req.on("close", () => listeners.delete(res));
			return;
		}
		if (route === "GET /api/hello") return send(res, 200, {
			version: 1,
			claude: {
				path: options.claudeProjects,
				exists: existsSync(options.claudeProjects)
			},
			codex: {
				path: options.codexSessions,
				exists: existsSync(options.codexSessions)
			},
			project,
			zstd
		});
		if (route === "GET /api/projects") {
			if (!recentCache || Date.now() - recentCache.at > 1e4 || url.searchParams.has("fresh")) recentCache = {
				at: Date.now(),
				list: await discoverProjects(options.claudeProjects, options.codexSessions)
			};
			return send(res, 200, recentCache.list);
		}
		if (route === "POST /api/project") {
			let wanted;
			try {
				wanted = JSON.parse(await readBody(req, 8192)).path;
			} catch {
				throw new HttpError(400, "경로를 읽지 못했어요.");
			}
			if (typeof wanted !== "string" || !path.isAbsolute(wanted)) throw new HttpError(400, "폴더의 전체 경로를 넣어 주세요. 예: C:\\work\\my-app");
			const resolved = path.resolve(wanted);
			let info;
			try {
				info = await stat(resolved);
			} catch {
				throw new HttpError(404, `폴더가 없어요: ${resolved}`);
			}
			if (!info.isDirectory()) throw new HttpError(400, "폴더가 아니에요.");
			project = {
				path: resolved,
				name: path.basename(resolved) || resolved
			};
			signature = await agentSignature(resolved);
			return send(res, 200, project);
		}
		if (route === "DELETE /api/project") {
			project = null;
			signature = null;
			return send(res, 200, { ok: true });
		}
		if (route === "GET /api/fs/stat") {
			const { root, parts, full } = await target(url);
			try {
				return send(res, 200, await statOf(root, parts, full));
			} catch (error) {
				if (error instanceof HttpError && error.status === 404) return send(res, 200, {
					kind: "none",
					size: 0,
					mtime: 0
				});
				throw error;
			}
		}
		if (route === "GET /api/fs/list") {
			const { root, parts, full } = await target(url);
			if (!canOpenDir(root, parts)) throw new HttpError(403, "이 폴더는 열지 않아요.");
			let entries;
			try {
				entries = await readdir(full, { withFileTypes: true });
			} catch {
				throw new HttpError(404, "없어요.");
			}
			const names = new Set(entries.map((entry) => entry.name));
			const out = [];
			for (const entry of entries) {
				const kind = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : null;
				if (!kind) continue;
				let name = entry.name;
				if (root === "codex-logs" && kind === "file" && name.endsWith(".jsonl.zst") && zstd) {
					name = name.slice(0, -4);
					if (names.has(name)) continue;
				}
				if (!canSee(root, parts, name, kind)) continue;
				try {
					const info = await stat(path.join(full, entry.name));
					out.push({
						name,
						kind,
						size: info.size,
						mtime: info.mtimeMs
					});
				} catch {}
			}
			return send(res, 200, out);
		}
		if (route === "GET /api/fs/read") {
			const { root, parts, full } = await target(url);
			if ((await statOf(root, parts, full)).kind !== "file") throw new HttpError(400, "파일이 아니에요.");
			const real = logFileOf(root, full);
			res.writeHead(200, {
				"content-type": "text/plain; charset=utf-8",
				"cache-control": "no-store",
				"x-content-type-options": "nosniff"
			});
			const stream = root === "project" ? createReadStream(real) : openLogStream(real);
			stream.on("error", () => res.destroy());
			stream.pipe(res);
			return;
		}
		if (route === "PUT /api/fs/write") {
			const { root, parts, base, full } = await target(url);
			if (!canWrite(root, parts, existsSync(full))) throw new HttpError(403, "이 파일은 쓰지 않아요. 역할 파일과 .teamcook/ 아래만 써요.");
			const text = await readBody(req);
			await mkdir(path.dirname(full), { recursive: true });
			if (!await staysInside(base, full)) throw new HttpError(403, "이 폴더 밖은 쓰지 않아요.");
			await writeFile(full, text, "utf8");
			return send(res, 200, { ok: true });
		}
		if (route === "DELETE /api/fs/remove") {
			const { root, parts, full } = await target(url);
			if (!canRemove(root, parts)) throw new HttpError(403, "역할 파일만 지울 수 있어요.");
			if (!existsSync(full)) throw new HttpError(404, "없어요.");
			await rm(full);
			return send(res, 200, { ok: true });
		}
		throw new HttpError(404, "없는 주소예요.");
	};
	const serveUi = async (res, url) => {
		if (!options.uiDir) return send(res, 404, { error: "화면 파일이 없어요." });
		const parts = splitPath(decodeURIComponent(url.pathname));
		if (!parts) return send(res, 400, { error: "이상한 경로예요." });
		let file = path.join(options.uiDir, ...parts);
		try {
			if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
		} catch {
			file = path.join(options.uiDir, "index.html");
		}
		try {
			const body = await readFile(file);
			res.writeHead(200, {
				"content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
				"cache-control": "no-cache",
				"x-content-type-options": "nosniff"
			});
			res.end(body);
		} catch {
			send(res, 404, { error: "없어요." });
		}
	};
	const server = http.createServer(async (req, res) => {
		try {
			const host = req.headers.host ?? "";
			if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, { error: "이 컴퓨터 안에서만 열 수 있어요." });
			const url = new URL(req.url ?? "/", `http://${host}`);
			if (!url.pathname.startsWith("/api/")) {
				if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "허용하지 않는 요청이에요." });
				return await serveUi(res, url);
			}
			const origin = req.headers.origin;
			if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return send(res, 403, { error: "다른 사이트에서 온 요청은 받지 않아요." });
			if (!sameKey(url.pathname === "/api/events" ? url.searchParams.get("key") : req.headers["x-teamcook-key"], key)) return send(res, 401, { error: "열쇠가 맞지 않아요. 터미널에 나온 주소로 다시 열어 주세요." });
			await api(req, res, url);
		} catch (error) {
			if (res.headersSent) return res.destroy();
			if (error instanceof HttpError) send(res, error.status, { error: error.message });
			else send(res, 500, { error: `도우미가 처리하지 못했어요: ${error.message}` });
		}
	});
	for (let attempt = 0;; attempt += 1) try {
		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(port, "127.0.0.1", () => {
				server.off("error", reject);
				resolve();
			});
		});
		break;
	} catch (error) {
		if (error.code !== "EADDRINUSE" || attempt >= 10 || options.port === 0) throw error;
		port += 1;
	}
	port = server.address().port;
	return {
		url: `http://127.0.0.1:${port}/`,
		key,
		port,
		close: async () => {
			watchers.forEach((item) => item.close());
			timers.forEach((item) => clearInterval(item));
			if (flushTimer) clearTimeout(flushTimer);
			listeners.forEach((res) => res.end());
			await new Promise((resolve) => server.close(() => resolve()));
		}
	};
}
// src/cli/main.ts
var HELP = `teamcook — AI 팀을 레시피로 요리하세요

사용법:
  node teamcook.mjs open                 내 컴퓨터 도우미를 켜고 브라우저로 teamcook을 연다
  node teamcook.mjs add "<공유 링크>" [옵션]   레시피를 지금 폴더에 설치한다

open 옵션:
  --port <번호>     도우미가 쓸 포트 (기본: 4417, 쓰이고 있으면 다음 번호)
  --no-browser      브라우저를 저절로 열지 않는다
  --ui <폴더>       화면 파일 폴더 (기본: 이 파일 옆의 ../dist)

add 옵션:
  --dir <폴더>      설치할 프로젝트 폴더 (기본: 지금 폴더)
  --force           같은 이름의 에이전트 파일이 있으면 덮어쓴다
  --codex-bridge    Claude Code에서 Codex 담당 에이전트를 codex exec로 부르게 설치한다 (실험적)
  --dry-run         실제로 쓰지 않고 무엇을 쓸지만 보여 준다

링크에는 #이 들어 있으니 꼭 따옴표로 감싸 주세요.
`;
function openBrowser(url) {
	const [command, args] = process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
	try {
		spawn(command, args, {
			stdio: "ignore",
			detached: true
		}).unref();
	} catch {}
}
async function open(rest) {
	let port = 4417;
	let browser = true;
	let uiDir = fileURLToPath(new URL("../dist/", import.meta.url));
	for (let i = 0; i < rest.length; i += 1) if (rest[i] === "--port") port = Number(rest[i += 1]) || port;
	else if (rest[i] === "--no-browser") browser = false;
	else if (rest[i] === "--ui") uiDir = path.resolve(rest[i += 1] ?? ".");
	if (!existsSync(path.join(uiDir, "index.html"))) {
		console.error(`화면 파일을 찾지 못했어요: ${uiDir}
저장소에서 먼저 npm run build 를 실행해 주세요.`);
		return 1;
	}
	const claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
	const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
	const server = await startLocalServer({
		uiDir,
		port,
		claudeProjects: path.join(claudeHome, "projects"),
		codexSessions: path.join(codexHome, "sessions")
	});
	const url = `${server.url}?key=${server.key}#/team`;
	console.log(`teamcook 도우미가 켜졌어요.

  주소: ${url}

읽는 곳 (대화 기록 파일 .jsonl·.jsonl.zst만, 읽기만):
  - ${path.join(claudeHome, "projects")}
  - ${path.join(codexHome, "sessions")}
쓰는 곳: 화면에서 고른 프로젝트의 .claude/agents, .codex/agents, .teamcook/ 뿐이에요.
인증·설정 파일은 열지 않고, AI를 실행하지 않고, 아무것도 바깥으로 보내지 않아요.

끝내려면 이 창에서 Ctrl+C를 누르세요.`);
	if (browser) openBrowser(url);
	await new Promise((resolve) => {
		process.once("SIGINT", resolve);
		process.once("SIGTERM", resolve);
	});
	await server.close();
	console.log("\n도우미를 껐어요.");
	return 0;
}
async function main(argv) {
	const [command, ...rest] = argv;
	if (!command || command === "--help" || command === "-h" || command === "help") {
		console.log(HELP);
		return 0;
	}
	if (command === "open") return open(rest);
	if (command !== "add") {
		console.error(`알 수 없는 명령이에요: ${command}\n`);
		console.log(HELP);
		return 1;
	}
	let link = "";
	let dir = process.cwd();
	let force = false;
	let codexBridge = false;
	let dryRun = false;
	for (let i = 0; i < rest.length; i += 1) {
		const arg = rest[i];
		if (arg === "--force") force = true;
		else if (arg === "--codex-bridge") codexBridge = true;
		else if (arg === "--dry-run") dryRun = true;
		else if (arg === "--dir") dir = path.resolve(rest[i += 1] ?? ".");
		else if (!link) link = arg;
	}
	if (!link) {
		console.error("공유 링크를 넣어 주세요. 예: node teamcook.mjs add \"https://…/#r=…\"");
		return 1;
	}
	const plan = planInstall(link, { codexBridge });
	if (!plan.ok) {
		console.error(`설치할 수 없어요: ${plan.error}`);
		return 1;
	}
	console.log(`레시피: ${plan.recipe.title} (에이전트 ${plan.recipe.cards.length}개)`);
	console.log(`설치 위치: ${dir}\n`);
	let skipped = 0;
	const hints = [];
	for (const file of plan.files) {
		const target = path.join(dir, file.path);
		if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) continue;
		const exists = existsSync(target);
		if (exists && (file.neverOverwrite || !force)) {
			skipped += 1;
			if (file.mergeHint) hints.push(file.mergeHint);
			console.log(`  건너뜀 (이미 있음)  ${file.path}`);
			continue;
		}
		if (!dryRun) {
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, file.content, "utf8");
		}
		console.log(`  ${dryRun ? "쓸 예정" : exists ? "덮어씀" : "만듦"}  ${file.path}`);
	}
	if (skipped > 0) {
		console.log("\n이미 있는 파일은 건드리지 않았어요. 덮어쓰려면 --force를 붙이세요.");
		for (const hint of hints) console.log(`- ${hint}`);
	}
	console.log("\n다음 단계: 실행 방법과 첫 프롬프트는 .teamcook/ 안의 RECIPE.md에 있어요.");
	return 0;
}
main(process.argv.slice(2)).then((code) => {
	process.exitCode = code;
	if (code === 0) process.exit(0);
}, (error) => {
	console.error(`도우미를 켜지 못했어요: ${error.message}`);
	process.exitCode = 1;
});
export {};
