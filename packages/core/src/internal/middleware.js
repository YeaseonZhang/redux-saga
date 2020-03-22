import * as is from '@redux-saga/is'
import { check, assignWithSymbols, createSetContextWarning } from './utils'
import { stdChannel } from './channel'
import { runSaga } from './runSaga'

export default function sagaMiddlewareFactory({ context = {}, channel = stdChannel(), sagaMonitor, ...options } = {}) {
  let boundRunSaga

  if (process.env.NODE_ENV !== 'production') {
    check(channel, is.channel, 'options.channel passed to the Saga middleware is not a channel')
  }

  /**
   * redux中间件标准写法
   * ({dispatch, getState}) => next => action { return next(action) }
   **/
  function sagaMiddleware({ getState, dispatch }) {
    // bind 使 runSaga 有预设参数，参考如下文档
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
    boundRunSaga = runSaga.bind(null, {
      ...options,
      context,
      channel,
      dispatch,
      getState,
      sagaMonitor,
    })

    return next => action => {
      if (sagaMonitor && sagaMonitor.actionDispatched) {
        sagaMonitor.actionDispatched(action)
      }
      // 先触发reducer，再处理action，所以side effect滞后于reducer
      const result = next(action) // hit reducers
      channel.put(action) // saga监听action的起点
      return result
    }
  }

  // 实际上等价于调用 runSaga
  sagaMiddleware.run = (...args) => {
    if (process.env.NODE_ENV !== 'production' && !boundRunSaga) {
      throw new Error('Before running a Saga, you must mount the Saga middleware on the Store using applyMiddleware')
    }
    return boundRunSaga(...args)
  }

  sagaMiddleware.setContext = props => {
    if (process.env.NODE_ENV !== 'production') {
      check(props, is.object, createSetContextWarning('sagaMiddleware', props))
    }

    assignWithSymbols(context, props)
  }

  return sagaMiddleware
}
