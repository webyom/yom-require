/*!
 * YOM module define and require lib 1.5.1
 * Inspired by RequireJS AMD spec
 * Copyright (c) 2012 Gary Wang, webyom@gmail.com http://webyom.org
 * Under the MIT license
 * https://github.com/webyom/yom-require
 */

var define, require

;(function (global) {
  if (require && require._YOM_) {
    return
  }

  /**
   * utils
   */
  var _head = document.head || document.getElementsByTagName('head')[0] || document.documentElement
  var _isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]'
  var _op = Object.prototype
  var _ots = _op.toString

  var _isArray = Array.isArray || function (obj) {
    return _ots.call(obj) == '[object Array]'
  }

  function _getArray(arr) {
    return Array.prototype.slice.call(arr)
  }

  function _isFunction(obj) {
    return _ots.call(obj) == '[object Function]'
  }

  function _hasOwnProperty(obj, prop) {
    return _op.hasOwnProperty.call(obj, prop)
  }

  function _trimTailSlash(path) {
    return path.replace(/\/+$/, '')
  }

  function _each(arr, callback) {
    for (var i = 0, l = arr.length; i < l; i++) {
      callback(arr[i], i, arr)
    }
  }

  function _extend(origin, extend, check) {
    origin = origin || {}
    for (var p in extend) {
      if (_hasOwnProperty(extend, p) && (!check || typeof origin[p] == 'undefined')) {
        origin[p] = extend[p]
      }
    }
    return origin
  }

  function _clone(obj, deep, _level) {
    var res = obj
    deep = deep || 0
    _level = _level || 0
    if (_level > deep) {
      return res
    }
    if (typeof obj == 'object' && obj) {
      if (_isArray(obj)) {
        res = []
        _each(obj, function (item) {
          res.push(item)
        })
      } else {
        res = {}
        for (var p in obj) {
          if (_hasOwnProperty(obj, p)) {
            res[p] = deep ? _clone(obj[p], deep, ++_level) : obj[p]
          }
        }
      }
    }
    return res
  }

  function _getInteractiveScript() {
    var script, scripts
    scripts = document.getElementsByTagName('script')
    for (var i = 0; i < scripts.length; i++) {
      script = scripts[i]
      if (script.readyState == 'interactive') {
        return script
      }
    }
    return script
  }

  function _getUrlParamObj(str) {
    if (!str) {
      return {}
    }
    var param = {}
    var tmp = str.replace(/^[?#]/, '').split('&')
    var i, item, key, val
    for (i = 0; i < tmp.length; i++) {
      item = tmp[i].split('=')
      key = item[0]
      val = decodeURIComponent(item[1] || '')
      param[key] = val
    }
    return param
  }

  function _getInterpolatedId(id) {
    id = id.replace(/\{\{(.+?)\}\}/g, function (full, v) {
      var res = global
      v = v.split('.')
      while (res && v.length) {
        res = res[v.shift()]
      }
      return res || full
    })
    return id
  }

  /**
   * config
   */
  var _PAGE_BASE_URL = location.protocol + '//' + location.host + location.pathname.split('/').slice(0, -1).join('/')
  var _RESERVED_NRM_ID = {
    require: 1,
    exports: 1,
    module: 1,
    global: 1,
    domReady: 1
  }
  var _ERR_CODE = {
    DEFAULT: 'others',
    TIMEOUT: 'timeout',
    LOAD_ERROR: 'loaderror',
    NO_DEFINE: 'nodefine',
    SCRIPT_ERROR: 'scripterror'
  }

  var _DEFAULT_CONFIG = {
    charset: 'utf-8',
    baseUrl: '',
    source: {},
    paths: {}, // match by id removed prefix
    fallbacks: {}, // match by id removed prefix
    shim: {}, // match by id removed prefix
    enforceDefine: false,
    deepNormalize: false,
    // global
    resolveUrl: null,
    errCallback: null,
    onLoadStart: null,
    onLoadEnd: null,
    waitSeconds: 30
  }
  var _gcfg = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize', 'resolveUrl', 'errCallback', 'onLoadStart', 'onLoadEnd', 'waitSeconds', 'deps', 'callback'], _clone(_DEFAULT_CONFIG, 1), typeof require == 'object' ? require : undefined) // global config
  _gcfg.baseUrl = _getFullBaseUrl(_gcfg.baseUrl)
  var _interactiveMode = false
  var _loadingCount = 0
  var _scriptBeingInserted = null

  var _hold = {} // loading or waiting dependencies
  var _interactiveDefQueue = {}
  var _defQueue = []
  var _postDefQueue = []
  var _defined = {}
  var _plugin = {}
  var _depReverseMap = {}

  function Def(nrmId, baseUrl, exports, module, getter, loader) {
    this._nrmId = nrmId
    this._baseUrl = baseUrl
    this._exports = exports
    this._module = module
    this._getter = getter
    this._loader = loader
    _defined[module.uri] = _defined[module.uri] || this
  }

  Def.prototype = {
    getDef: function (context) {
      if (this._getter) {
        return this._getter(context)
      } else {
        return this._exports
      }
    },

    getLoader: function () {
      return this._loader
    },

    constructor: Def
  }

  new Def('require', _gcfg.baseUrl, {}, {id: 'require', uri: 'require'}, function (context) {
    return _makeRequire({config: context.config, base: context.base})
  })
  new Def('exports', _gcfg.baseUrl, {}, {id: 'exports', uri: 'exports'}, function (context) {
    return {}
  })
  new Def('module', _gcfg.baseUrl, {}, {id: 'module', uri: 'module'}, function (context) {
    return {}
  })
  new Def('global', _gcfg.baseUrl, global, {id: 'global', uri: 'global'})
  new Def('domReady', _gcfg.baseUrl, {}, {id: 'domReady', uri: 'domReady'}, function (context) {
    return {}
  }, (function () {
    var _queue = []
    var _checking = false
    var _ready = false

    function _onready() {
      if (_ready) {
        return
      }
      _ready = true
      while (_queue.length) {
        domReadyLoader.apply(null, _getArray(_queue.shift()))
      }
    }

    function _onReadyStateChange() {
      if (document.readyState == 'complete') {
        _onready()
      }
    }

    function _checkReady() {
      if (_checking || _ready) {
        return
      }
      _checking = true
      if (document.readyState == 'complete') {
        _onready()
      } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', _onready, false)
        window.addEventListener('load', _onready, false)
      } else {
        document.attachEvent('onreadystatechange', _onReadyStateChange)
        window.attachEvent('onload', _onready)
      }
    }

    function domReadyLoader(context, onRequire) {
      if (_ready) {
        onRequire(0)
      } else {
        _queue.push(arguments)
        _checkReady()
      }
    }

    return domReadyLoader
  })())

  function Hold(id, nrmId, config) {
    var baseUrl = config.baseUrl
    var noPrefixId = _removeIdPrefix(id)
    this._id = id
    this._nrmId = nrmId
    this._baseUrl = baseUrl
    this._config = config
    this._defineCalled = false
    this._queue = []
    this._fallbacks = config.fallbacks[noPrefixId]
    this._shim = config.shim[noPrefixId]
    this._uri = _getFullUrl(nrmId, baseUrl)
    if (!_isArray(this._fallbacks)) {
      this._fallbacks = [this._fallbacks]
    }
    _hold[this._uri] = this
  }

  Hold.prototype = {
    push: function (onRequire) {
      this._queue.push(onRequire)
    },

    defineCall: function () {
      this._defineCalled = true
    },

    isDefineCalled: function () {
      return this._defineCalled
    },

    remove: function () {
      delete _hold[this._uri]
    },

    dispatch: function (errCode, errObj, opt) {
      var callback
      if (this._queue.length) {
        while (this._queue.length) {
          callback = this._queue.shift()
          if (callback) {
            callback(errCode, errObj, opt || {uri: this._uri})
          }
        }
      } else if (errCode) {
        _dealError(errCode, errObj, opt)
      }
    },

    getConfig: function () {
      return this._config
    },

    getShim: function () {
      return this._shim
    },

    getFallback: function () {
      return this._fallbacks.shift()
    },

    loadShimDeps: function (callback) {
      var id = this._id
      var nrmId = this._nrmId
      var config = this._config
      var shim = this._shim
      if (shim.deps) {
        _makeRequire({deps: shim.deps, config: config, base: {id: id, nrmId: nrmId, baseUrl: this._baseUrl}})(shim.deps, function () {
          callback()
        }, function (err) {
          callback(err.info.errCode, err, err.info.module)
        })
      } else {
        callback()
      }
    },

    shimDefine: function () {
      var hold = this
      var id = this._id
      var nrmId = this._nrmId
      var baseUrl = this._baseUrl
      var config = this._config
      var shim = this._shim
      var exports
      if (config.enforceDefine && !shim) {
        return false
      }
      if (shim && shim.exports) {
        exports = _getShimExports(shim.exports)
        if (!exports) {
          return false
        }
      }
      var deps = shim && shim.deps || []
      _makeRequire({deps: deps, config: config, base: {id: id, nrmId: nrmId, baseUrl: baseUrl}})(deps, function () {
        var args = _getArray(arguments)
        if (shim && shim.init) {
          exports = shim.init.apply(global, args) || exports
        }
        new Def(nrmId, baseUrl, exports, {id: nrmId, uri: _getFullUrl(nrmId, baseUrl)})
        hold.remove()
        hold.dispatch(0)
      }, function (err) {
        hold.remove()
        hold.dispatch(err.info.errCode, err, err.info.module)
      })
      return true
    },

    constructor: Hold
  }

  function Plugin(name) {
    this._name = name
    _plugin[name] = this
  }

  Plugin.prototype = {
    _paramsToken: '@',

    _getResource: function (id) {
      var res = _removePluginPrefix(id).split(this._paramsToken)
      return res.slice(0, res.length - 1 || 1).join(this._paramsToken)
    },

    _getParams: function (id) {
      var params = {}
      var i, item
      var tmp = id.split(this._paramsToken)
      if (tmp.length < 2) {
        return params
      }
      tmp = tmp.pop().split('&')
      for (i = 0; i < tmp.length; i++) {
        item = tmp[i].split('=')
        params[item[0]] = item[1]
      }
      return params
    },

    require: function (id, config, callback, errCallback) {
      if (callback) {
        callback(this)
      }
      return this
    },

    constructor: Plugin
  }

  function _getHold(nrmId, baseUrl) {
    var url = _getFullUrl(nrmId, baseUrl)
    return _hold[url]
  }

  function _getDefined(id, nrmId, config) {
    var def, shim, exports, module
    var url = _getFullUrl(nrmId, config.baseUrl)
    def = _defined[url]
    if (!def) {
      shim = config.shim[_removeIdPrefix(id)]
      if (shim && shim.exports) {
        exports = _getShimExports(shim.exports)
        if (exports) {
          module = {
            id: nrmId,
            uri: _getFullUrl(nrmId, config.baseUrl)
          }
          def = new Def(nrmId, config.baseUrl, exports, module)
        }
      }
    }
    return def
  }

  function _getPlugin(pluginName) {
    return _plugin[pluginName]
  }

  function _getShimExports(name) {
    var exports = global
    name = name.split('.')
    while (exports && name.length) {
      exports = exports[name.shift()]
    }
    return exports
  }

  function _getInteractiveDefQueue(nrmId, baseUrl) {
    var fullUrl = _getFullUrl(nrmId, baseUrl) || 'require'
    _interactiveDefQueue[fullUrl] = _interactiveDefQueue[fullUrl] || {
      defQueue: [], postDefQueue: []
    }
    return _interactiveDefQueue[fullUrl]
  }

  function _getDepReverseMap(url) {
    var map = _depReverseMap[url] = _depReverseMap[url] || {}
    return map
  }

  function _setDepReverseMap(url, depReverseUrl) {
    var map = _getDepReverseMap(url)
    map[depReverseUrl] = 1
  }

  function _hasCircularDep(depReverseUrl, url, _checkedUrls) {
    var depMap = _getDepReverseMap(depReverseUrl)
    var p
    _checkedUrls = _checkedUrls || {}
    if (_checkedUrls[depReverseUrl]) {
      return false
    }
    if (url == depReverseUrl || depMap[url]) {
      return true
    }
    _checkedUrls[depReverseUrl] = 1
    for (p in depMap) {
      if (!_hasOwnProperty(depMap, p)) {
        continue
      }
      if (_hasCircularDep(p, url, _checkedUrls)) {
        return true
      }
    }
    return false
  }

  /**
   * id start width 'http:', 'https:', '/', or end with '.js' is unnormal
   */
  function _isUnnormalId(id) {
    return (/^https?:|^\/|\.js$/).test(id)
  }

  function _isRelativePath(path) {
    return (path + '').indexOf('.') === 0
  }

  function _removeIdPrefix(id) {
    return id.replace(/^([a-zA-Z0-9_\-]+?!)?([a-zA-Z0-9_\-]+?#)?/, '')
  }

  function _removePluginPrefix(id) {
    return id.replace(/^[a-zA-Z0-9_\-]+?!/, '')
  }

  function _getSourceName(id) {
    var m = id.match(/^([^#]+?)#/)
    return m && m[1] || ''
  }

  function _getPluginName(id) {
    var m = id.match(/^([^!]+?)!/)
    return m && m[1] || ''
  }

  function _normalizeId(id, base, config) {
    var paths, nrmId, a, b, maped
    if (!id) {
      return id
    }
    id = _removeIdPrefix(id) // remove source or plugin prefix
    if (_isUnnormalId(id)) {
      return id
    }
    if (base && _isRelativePath(id)) {
      if (_isUnnormalId(base.nrmId)) {
        id += '.js'
      }
      return _resolvePath(base.nrmId, id)
    } else {
      nrmId = id
    }
    if (_isRelativePath(nrmId)) {
      return nrmId
    }
    paths = config.paths
    if (paths) {
      a = nrmId.split('/')
      b = []
      while (a.length) {
        maped = paths[a.join('/')]
        if (maped) {
          b.unshift(_trimTailSlash(maped))
          a = b.join('/')
          if (a != nrmId && config.deepNormalize) {
            return _normalizeId(a, base, config)
          }
          return a
        }
        b.unshift(a.pop())
      }
    }
    return nrmId
  }

  function _extendConfig(props, config, ext) {
    if (!config) {
      return ext
    } else if (!ext || config == ext || (props.length === 1 && props[0] == 'baseUrl' && config.baseUrl == ext.baseUrl)) {
      return config
    }
    ext.baseUrl = _getFullBaseUrl(ext.baseUrl)
    if (ext.baseUrl && config.baseUrl != ext.baseUrl) {
      config = _clone(_DEFAULT_CONFIG, 1)
    } else {
      config = _clone(config, 1)
    }
    _each(props, function (p) {
      config[p] = typeof config[p] == 'object' && typeof ext[p] == 'object' ? _extend(config[p], ext[p]) :
          typeof ext[p] == 'undefined' ? config[p] : ext[p]
    })
    return config
  }

  function _getOrigin() {
    return location.origin || location.protocol + '//' +  location.host
  }

  function _resolvePath(base, path) {
    if (!_isRelativePath(path)) {
      return path
    }
    var bArr = base.split('/'),
      pArr = path.split('/'),
      part
    bArr.pop()
    while (pArr.length) {
      part = pArr.shift()
      if (part == '..') {
        if (bArr.length) {
          part = bArr.pop()
          while (part == '.') {
            part = bArr.pop()
          }
          if (part == '..') {
            bArr.push('..', '..')
          }
        } else {
          bArr.push(part)
        }
      } else if (part != '.') {
        bArr.push(part)
      }
    }
    path = bArr.join('/')
    return path
  }

  function _getFullBaseUrl(url) {
    if (url) {
      if (url.indexOf('://') < 0 && url.indexOf('//') !== 0) {
        if (url.indexOf('/') === 0) {
          url = _getOrigin() + _trimTailSlash(url)
        } else {
          url = _getOrigin() + _resolvePath(location.pathname, _trimTailSlash(url))
        }
      } else {
        url = _trimTailSlash(url)
      }
    }
    return url
  }

  function _getFullUrl(nrmId, baseUrl) {
    var url = ''
    baseUrl = baseUrl || _gcfg.baseUrl
    if (_RESERVED_NRM_ID[nrmId] || _isUnnormalId(nrmId)) {
      url = nrmId
    } else if (nrmId && _isRelativePath(nrmId)) {
      url = _resolvePath(baseUrl + '/', nrmId) + '.js'
    } else if (nrmId) {
      url = baseUrl + '/' + nrmId + '.js'
    }
    if (_gcfg.resolveUrl) {
      url = _gcfg.resolveUrl(url)
    }
    return url
  }

  function _getCharset(id, charset) {
    if (typeof charset == 'string') {
      return charset
    } else {
      return charset && (charset[_removeIdPrefix(id)] || charset['*']) || ''
    }
  }

  function _endLoad(jsNode, onload, onerror) {
    _loadingCount--
    if (jsNode.attachEvent && !_isOpera) {
      jsNode.detachEvent('onreadystatechange', onload)
    } else {
      jsNode.removeEventListener('load', onload, false)
      jsNode.removeEventListener('error', onerror, false)
    }
    jsNode.parentNode.removeChild(jsNode)
    if (_loadingCount === 0 && _gcfg.onLoadStart) {
      _gcfg.onLoadEnd()
    }
  }

  function _dealError(errCode, errObj, opt, errCallback) {
    var info
    opt = opt || {}
    if (!errObj) {
      if (opt.uri) {
        errObj = new Error('Failed to load ' + opt.uri)
      } else {
        errObj = new Error('Load Error')
      }
    }
    info = {
      errCode: errCode,
      module: opt
    }
    errObj.info = info
    if (errCallback) {
      errCallback(errObj)
    } else if (_gcfg.errCallback) {
      _gcfg.errCallback(errObj)
    } else {
      throw errObj
    }
  }

  function _loadPlugin(pluginName, id, config, onRequire) {
    require(['require-plugin/' + pluginName], function (pluginDef) {
      var plugin = _plugin[pluginName]
      if (!plugin) {
        if (pluginDef.factory) {
          plugin = _plugin[pluginName] = pluginDef.factory(Plugin)
        } else {
          plugin = _plugin[pluginName] = _extend(new Plugin(pluginName), pluginDef)
        }
      }
      plugin.require(id, config, function (res) {
        onRequire(0)
      }, onRequire)
    }, function (err, info) {
      onRequire(info.errCode, info.errObj, info.opt)
    })
  }

  function _doLoad(id, nrmId, config, hold) {
    var combo, comboUrl, baseUrl, charset, jsNode, urlArg, loadUrl, onRequireOpt
    combo = typeof id == 'object' && id && id.combo && id
    if (combo) {
      comboUrl = nrmId
      id = combo.id
      nrmId = combo.nrmId
    }
    baseUrl = config.baseUrl
    charset = _getCharset(id, config.charset)
    jsNode = document.createElement('script')
    if (jsNode.attachEvent && !_isOpera) {
      _interactiveMode = true
      jsNode.attachEvent('onreadystatechange', _ieOnload)
    } else {
      jsNode.addEventListener('load', _onload, false)
      jsNode.addEventListener('error', _onerror, false)
    }
    if (charset) {
      jsNode.charset = charset
    }
    jsNode.type = 'text/javascript'
    jsNode.async = 'async'
    loadUrl = comboUrl || _getFullUrl(nrmId, baseUrl)
    jsNode.src = loadUrl
    jsNode.setAttribute('data-nrm-id', nrmId)
    jsNode.setAttribute('data-base-url', baseUrl)
    _scriptBeingInserted = jsNode
    _head.insertBefore(jsNode, _head.firstChild)
    _scriptBeingInserted = null
    _loadingCount++
    if (_loadingCount === 1 && _gcfg.onLoadStart) {
      _gcfg.onLoadStart()
    }
    onRequireOpt = {id: id || nrmId, nrmId: nrmId, uri: loadUrl}
    function _ieOnload() {
      var fallback
      if (jsNode && (jsNode.readyState == 'loaded' || jsNode.readyState == 'complete')) {
        _endLoad(jsNode, _ieOnload)
        jsNode = null
        _processDefQueue(nrmId, baseUrl, config, combo)
        if (!hold.isDefineCalled() && !hold.shimDefine()) {
          fallback = hold.getFallback()
          if (fallback) {
            _doLoad(id, fallback, config, hold)
          } else {
            hold.remove()
            hold.dispatch(_ERR_CODE.LOAD_ERROR, null, onRequireOpt)
          }
        }
      }
    }
    function _onload() {
      var def, fallback
      _endLoad(jsNode, _onload, _onerror)
      _processDefQueue(nrmId, baseUrl, config, combo)
      if (!hold.isDefineCalled() && !hold.shimDefine()) {
        fallback = hold.getFallback()
        if (fallback) {
          _doLoad(id, fallback, config, hold)
        } else {
          hold.remove()
          hold.dispatch(_ERR_CODE.NO_DEFINE, null, onRequireOpt)
        }
      }
    }
    function _onerror() {
      var fallback = hold.getFallback()
      _endLoad(jsNode, _onload, _onerror)
      if (fallback) {
        _doLoad(id, fallback, config, hold)
      } else {
        hold.remove()
        hold.dispatch(_ERR_CODE.LOAD_ERROR, null, onRequireOpt)
      }
    }
  }

  function _load(id, nrmId, config, onRequire) {
    var combo = typeof id == 'object' && id && id.combo && id,
      baseUrl = config.baseUrl
    var def, hold, comboUrl, comboHold
    var comboNeedLoad = false
    if (combo) {
      comboUrl = nrmId
      id = combo.id
      nrmId = combo.nrmId
      hold = _getHold(combo.nrmId, baseUrl)
    } else {
      def = _getDefined(id, nrmId, config)
      hold = _getHold(nrmId, baseUrl)
    }
    if (def) {
      onRequire(0)
      return
    } else if (hold) {
      hold.push(onRequire)
      return
    }
    hold = new Hold(id, nrmId, config)
    hold.push(onRequire)
    if (combo) {
      comboHold = hold
      _each(combo.load, function (item, i) {
        var hold = _getHold(item.nrmId, baseUrl)
        if (!hold) {
          hold = new Hold(item.id, item.nrmId, config)
          comboNeedLoad = true
        }
        hold.push(function (errCode, errObj, opt) {
          if (errCode) {
            comboHold.dispatch(errCode, errObj, opt)
          } else {
            combo.loadCount++
            if (combo.loadCount === combo.postLoadList.length) {
              comboHold.defineCall()
              comboHold.dispatch(0)
            }
          }
        })
      })
      comboNeedLoad && _doLoad(combo, comboUrl, config, hold)
    } else {
      if (hold.getShim()) {
        hold.loadShimDeps(function (errCode, errObj, opt) {
          if (errCode) {
            hold.remove()
            hold.dispatch(errCode, errObj, opt)
          } else {
            _doLoad(id, nrmId, config, hold)
          }
        })
      } else {
        _doLoad(id, nrmId, config, hold)
      }
    }
  }

  function _processDefQueue(nrmId, baseUrl, config, combo) {
    var def, queue, defQueue, postDefQueue
    if (_interactiveMode) {
      queue = _getInteractiveDefQueue(nrmId, baseUrl)
      defQueue = queue['defQueue']
      postDefQueue = queue['postDefQueue']
    } else {
      defQueue = _defQueue
      postDefQueue = _postDefQueue
    }
    def = defQueue.shift()
    while (def) {
      _defineCall(def.id, def.deps, def.factory, {
        nrmId: nrmId || def.id,
        baseUrl: baseUrl || def.config && def.config.baseUrl || config && config.baseUrl || _gcfg.baseUrl,
        config: config
      }, def.config, postDefQueue, combo)
      def = defQueue.shift()
    }
    def = postDefQueue.shift()
    while (def) {
      _postDefineCall(def.base, def.deps, def.factory, def.hold, def.config)
      def = postDefQueue.shift()
    }
  }

  /**
   * define
   */
  function _defineCall(id, deps, factory, loadInfo, config, postDefQueue, combo) {
    var nrmId, loadHold, hold
    var baseUrl = loadInfo.baseUrl
    var baseConfig = loadInfo.config || config
    config = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize'], baseConfig, config)
    loadHold = _getHold(loadInfo.nrmId, baseUrl)
    if (combo) {
      loadInfo.nrmId = combo.load[0].nrmId
      nrmId = _normalizeId(id, loadInfo, config)
      if (!nrmId || nrmId == loadInfo.nrmId) {
        nrmId = combo.load.shift() // process the first load item
        combo.postLoadList.push(nrmId) // then push is to the processed list
        nrmId = nrmId.nrmId
        hold = _getHold(nrmId, baseUrl)
        hold.defineCall()
        if (!combo.load.length) { // all the load items have been loaded
          loadHold.defineCall()
        }
      } else { // multiple define in a file
        hold = new Hold(id, nrmId, baseConfig)
        hold.defineCall()
      }
    } else {
      if (id == loadInfo.nrmId) { // html built in module
        nrmId = loadInfo.nrmId
      } else {
        nrmId = _normalizeId(id, loadInfo, config)
      }
      if ((!nrmId || nrmId == loadInfo.nrmId) && loadHold) {
        nrmId = loadInfo.nrmId
        hold = loadHold
        hold.defineCall()
      } else { // multiple define in a file
        hold = new Hold(id, nrmId, baseConfig)
        hold.defineCall()
      }
    }
    postDefQueue.push({
      base: {
        id: id,
        nrmId: nrmId,
        baseUrl: baseUrl,
        config: baseConfig
      },
      deps: deps,
      factory: factory,
      hold: hold,
      config: config
    })
  }

  function _postDefineCall(base, deps, factory, hold, config) {
    _makeRequire({deps: deps, config: config, base: base})(deps, function constructModule() {
      var nrmId
      if (!base.baseUrl && (/^require-plugin\//).test(base.nrmId)) { // require-plugin builtin with html
        nrmId = _normalizeId(base.nrmId, base, config)
      } else {
        nrmId = base.nrmId
      }
      var baseUrl = base.baseUrl || config.baseUrl
      var exports, module, args, shim
      var uri = _getFullUrl(nrmId, baseUrl)
      module = {
        id: nrmId,
        uri: uri
      }
      if (_isFunction(factory)) {
        args = _getArray(arguments)
        _each(deps, function (dep, i) {
          if (dep == 'exports') {
            exports = module.exports = args[i] = exports || {}
          } else if (dep == 'module') {
            args[i] = module
          }
        })
        try {
          exports = factory.apply(null, args) || module.exports
        } catch (e) {
          hold.remove()
          hold.dispatch(_ERR_CODE.SCRIPT_ERROR, e, {id: base.id || nrmId, nrmId: nrmId, uri: uri})
        }
      } else {
        exports = factory
      }
      shim = config.shim[_removeIdPrefix(hold._id)]
      if (shim && shim.exports) {
        exports = _getShimExports(shim.exports)
      }
      module.exports = exports
      new Def(nrmId, baseUrl, exports, module)
      hold.remove()
      hold.dispatch(0)
    }, function (err) {
      hold.remove()
      hold.dispatch(err.info.errCode, err, err.info.module)
    })
  }

  function _makeDefine(context) {
    var config
    context = context || {}
    context.parentConfig = context.parentConfig || _gcfg
    config = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize'], context.parentConfig, context.config)
    function def(id, deps, factory) {
      var script, factoryStr, reqFnName, defQueue
      if (typeof id != 'string') {
        factory = deps
        deps = id
        id = ''
      }
      if (typeof factory == 'undefined' || !_isArray(deps)) {
        factory = deps
        deps = []
      }
      if (!deps.length && _isFunction(factory) && factory.length) {
        factoryStr = factory.toString()
        reqFnName = factoryStr.match(/^function[^\(]*\(([^\)]+)\)/) || ['', 'require']
        reqFnName = (reqFnName[1].split(',')[0]).replace(/\s/g, '')
        factoryStr.replace(new RegExp('(?:^|[^\\.\\/\\w])' + reqFnName + '\\s*\\(\\s*(["\'])([^"\']+?)\\1\\s*\\)', 'g'), function (full, quote, dep) { // extract dependencies
            dep = _getInterpolatedId(dep)
            deps.push(dep)
          })
        deps = (factory.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps)
      }
      if (_interactiveMode) {
        script = _scriptBeingInserted || _getInteractiveScript()
        if (script) {
          defQueue = _getInteractiveDefQueue(script.getAttribute('data-nrm-id'), script.getAttribute('data-base-url'))['defQueue']
        }
      } else {
        defQueue = _defQueue
      }
      defQueue.push({
        id: id,
        deps: deps,
        factory: factory,
        config: config
      })
      return def
    }
    def.config = function (conf) {
      config = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize', 'resolveUrl', 'errCallback', 'onLoadStart', 'onLoadEnd', 'waitSeconds'], config, conf)
      return def
    }
    def.extend = function (conf) {
      return _makeDefine({config: conf, parentConfig: config})
    }
    def.amd = {}
    return def
  }

  define = _makeDefine()
  define._ROOT_ = true

  /**
   * require
   */
  function _getComboUrl(loadList, baseUrl) {
    var combo = []
    var comboUrl
    var hostName = baseUrl.split('/').slice(0, 3).join('/')
    _each(loadList, function (item, i) {
      baseUrl = item.config.baseUrl
      var hostName = baseUrl.split('/').slice(0, 3).join('/')
      var base = baseUrl.slice(hostName.length)
      if (_isUnnormalId(item.nrmId)) {
        combo.push(base + item.nrmId)
      } else {
        combo.push(base + '/' + item.nrmId + '.js')
      }
    })
    comboUrl = hostName + '/c/=' + combo.join(',')
    return comboUrl
  }

  function _loadCombo(combo, config, context, callback) {
    var callArgs = combo.combo
    var baseUrl = config.baseUrl
    var hold = _getHold(combo.nrmId, baseUrl)
    if (hold) {
      hold.push(onRequire)
    } else {
      _load(combo, _getComboUrl(combo.load, baseUrl), config, onRequire)
    }
    function onRequire(errCode, errObj, opt) {
      if (!errCode) {
        _each(callArgs, function (arg, i) {
          var def
          if (typeof arg == 'undefined') {
            arg = combo.postLoadList.shift()
            def = _getDefined(arg.id, arg.nrmId, arg.config)
            callArgs[i] = def.getDef(context)
          }
        })
      }
      callback(errCode, errObj, opt)
    }
  }

  function _getDep(id, config, context) {
    var base, conf, nrmId, def, pluginName, sourceConf, fullUrl, baseFullUrl, loader
    if (!id) {
      return {}
    }
    pluginName = _getPluginName(id)
    if (pluginName) {
      return {plugin: _getPlugin(pluginName), load: {pluginName: pluginName, id: id, nrmId: id, config: config}}
    }
    def = _defined[id]
    if (def) { // reserved
      loader = def.getLoader()
      if (loader) {
        return {inst: def, load: {loader: loader, id: id, nrmId: id, config: config}}
      } else {
        return {inst: def}
      }
    }
    sourceConf = config.source[_getSourceName(id)]
    conf = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize'], config, sourceConf)
    base = context.base
    nrmId = _normalizeId(id, base, conf)
    if (_isRelativePath(id)) {
      conf = base && base.config || conf
    }
    def = _getDefined(id, nrmId, conf)
    fullUrl = _getFullUrl(nrmId, conf.baseUrl)
    if (base) {
      baseFullUrl = _getFullUrl(base.nrmId, base.baseUrl)
      context.deps && _setDepReverseMap(fullUrl, baseFullUrl)
      if (!def && !_getDefined(base.id, base.nrmId, base.config || conf) && _hasCircularDep(baseFullUrl, fullUrl)) { // cirular dependency
        return {}
      }
    }
    if (def) {
      return {inst: def}
    } else {
      return {load: {id: id, nrmId: nrmId, config: conf}}
    }
  }

  function _makeRequire(context) {
    var config, req
    context = context || {}
    context.parentConfig = context.parentConfig || _gcfg
    config = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize'], context.parentConfig, context.config)
    function require(deps, callback, errCallback) {
      var over = false
      var loadList = []
      var def, count, callArgs, toRef
      if (typeof deps == 'string') {
        deps = _getInterpolatedId(deps)
        if (arguments.length === 1) {
          def = _getDep(deps, config, context)
          if (def.plugin) {
            return def.plugin.require(deps, config)
          } else {
            return def.inst && def.inst.getDef(context)
          }
        } else {
          throw new Error('Wrong arguments for require.')
        }
      }
      callArgs = new Array(deps.length)
      _each(deps, function (id, i) {
        var def, combo, comboIds
        if (id.indexOf('combine:') === 0) {
          id = id.replace(/\s+/g, '')
          comboIds = id.replace(/^combine:/, '').split(',')
          combo = {
            id: id,
            nrmId: id,
            combo: new Array(comboIds.length), // combo module definitions
            load: [], // need to be loaded
            loadCount: 0, // loaded count
            postLoadList: [] // loaded items
          }
          _each(comboIds, function (id, i) {
            def = _getDep(id, config, context)
            if (def.load) {
              combo.load.push(def.load)
            } else if (def.inst) {
              combo.combo[i] = def.inst.getDef(context)
            } else {
              combo.combo[i] = null
            }
          })
          if (combo.load.length) {
            loadList.push(combo)
          } else {
            callArgs[i] = combo.combo
          }
        } else {
          def = _getDep(id, config, context)
          if (def.load) {
            loadList.push(def.load)
          } else if (def.inst) {
            callArgs[i] = def.inst.getDef(context)
          } else {
            callArgs[i] = null
          }
        }
      })
      count = loadList.length
      if (count) {
        if (!context.base) {
          toRef = setTimeout(function () {
            if (over) {
              return
            }
            over = true
            _dealError(_ERR_CODE.TIMEOUT, null, {}, errCallback)
          }, config.waitSeconds * 1000)
        }
        _each(loadList, function (item, i) {
          var hold
          if (item.combo) { // combine
            _loadCombo(item, config, context, onRequire)
          } else if (item.loader) { // reserved module loader
            item.loader(context, onRequire)
          } else if (item.pluginName) { // plugin
            _loadPlugin(item.pluginName, item.id, item.config, onRequire)
          } else {
            hold = _getHold(item.nrmId, item.config.baseUrl)
            if (hold) {
              hold.push(onRequire)
            } else {
              _load(item.id, item.nrmId, item.config, onRequire)
            }
          }
        })
      } else {
        callback && callback.apply(null, callArgs)
      }
      function onRequire(errCode, errObj, opt) {
        if (over) {
          return
        }
        if (errCode) {
          over = true
          clearTimeout(toRef)
          _dealError(errCode, errObj, opt, errCallback)
        } else {
          count--
          if (count <= 0) {
            over = true
            clearTimeout(toRef)
            if (callback) {
              _each(callArgs, function (arg, i) {
                var def, plugin
                if (typeof arg == 'undefined') {
                  arg = loadList.shift()
                  if (arg.combo) { // combine
                    callArgs[i] = arg.combo
                  } else if (arg.pluginName) { // plugin
                    plugin = _getPlugin(arg.pluginName)
                    callArgs[i] = plugin.require(arg.id, config)
                  } else {
                    def = _getDefined(arg.id, arg.nrmId, arg.config)
                    callArgs[i] = def.getDef(context)
                  }
                }
              })
              callback.apply(null, callArgs)
            }
          }
        }
      }
      return require
    }
    if (global.Promise) {
      req = function (deps, callback, errCallback) {
        if (typeof deps == 'string') {
          return require(deps)
        } else {
          return new global.Promise(function (resolve, reject) {
            require(deps, function () {
              var res = Array.prototype.slice.call(arguments)
              resolve(res)
              callback && callback.apply(null, res)
            }, function (err) {
              reject(err)
              errCallback && errCallback(err)
            })
          })
        }
      }
    } else {
      req = require
    }
    req.config = function (conf) {
      config = _extendConfig(['charset', 'baseUrl', 'source', 'paths', 'fallbacks', 'shim', 'enforceDefine', 'deepNormalize', 'resolveUrl', 'errCallback', 'onLoadStart', 'onLoadEnd', 'waitSeconds'], config, conf)
      if (req._ROOT_) {
        _gcfg = config
        define.config(conf)
      }
      return req
    }
    req.extend = function (conf) {
      return _makeRequire({config: conf, parentConfig: config})
    }
    req.getConfig = function (key) {
      if (key) {
        return config[key]
      }
      return config
    }
    req.toUrl = function (url, onlyPath) {
      if (context.base) {
        url = _resolvePath(_getFullUrl(context.base.nrmId, context.base.baseUrl), url)
      } else {
        url = _resolvePath(config.baseUrl + '/', url)
      }
      if (onlyPath) {
        url = url.replace(/^https?:\/\/[^\/]*?\//, '/')
      }
      return url
    }
    req.getLoadingCount = function () {
      return _loadingCount
    }
    req.ERR_CODE = _ERR_CODE
    return req
  }

  require = _makeRequire()

  require._YOM_ = true
  require._ROOT_ = true
  require.PAGE_BASE_URL = _PAGE_BASE_URL
  // for modules built with require.js or html builtin
  require.processDefQueue = _processDefQueue
  // for modules built with require.js or html builtin
  require.getBaseUrlConfig = function (baseUrl) {
    return _extendConfig(['baseUrl'], _gcfg, {baseUrl: baseUrl || _PAGE_BASE_URL})
  }
  // debug
  require._debug = {
    interactiveDefQueue: _interactiveDefQueue,
    defQueue: _defQueue,
    postDefQueue: _postDefQueue,
    hold: _hold,
    defined: _defined,
    plugin: _plugin,
    depReverseMap: _depReverseMap
  }

  ;(function () {
    var scripts, script, i, main, baseUrl
    scripts = document.getElementsByTagName('script')
    for (i = scripts.length - 1; i >= 0; i--) {
      script = scripts[i]
      main = script.getAttribute('data-main')
      if (main) {
        baseUrl = script.getAttribute('data-base-url')
        if (baseUrl) {
          _gcfg.baseUrl = _getFullBaseUrl(baseUrl)
        } else if (!_gcfg.baseUrl) {
          if (_isUnnormalId(main)) {
            _gcfg.baseUrl = _getFullBaseUrl(main.split('/').slice(0, -1).join('/'))
          } else {
            _gcfg.baseUrl = _PAGE_BASE_URL
          }
        }
        require([main], function (main) {
          if (_isFunction(main.init)) {
            main.init(_getUrlParamObj(script.getAttribute('data-param')))
          }
        })
        return
      }
    }
    if (!_gcfg.baseUrl) {
      _gcfg.baseUrl = _PAGE_BASE_URL
    }
    if (_gcfg.deps) {
      require(_gcfg.deps, _gcfg.callback)
    }
  })()
})(this)
