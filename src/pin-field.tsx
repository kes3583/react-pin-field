import React, {FC, useCallback, useEffect, useRef, useReducer} from "react"
import classNames from "classnames"

import {
  PinFieldDefaultProps as DefaultProps,
  PinFieldProps as Props,
  PinFieldState as State,
  PinFieldAction as Action,
  PinFieldEffect as Effect,
} from "./pin-field.types"

// TODO: unit tests
export const IGNORED_META_KEYS = ["Tab", "Enter", "Shift", "Meta", "Control", "Alt"]

// TODO: unit tests
export const defaultProps: DefaultProps = {
  className: "",
  length: 5,
  validate: /^[a-zA-Z0-9]$/,
  format: key => key,
  onResolveKey: () => {},
  onRejectKey: () => {},
  onChange: () => {},
  onComplete: () => {},
  style: {},
}

// TODO: unit tests
export function getPrevFocusIdx(currFocusIdx: number) {
  return Math.max(0, currFocusIdx - 1)
}

// TODO: unit tests
export function getNextFocusIdx(currFocusIdx: number, lastFocusIdx: number) {
  return Math.min(currFocusIdx + 1, lastFocusIdx - 1)
}

// TODO: unit tests
export function isKeyAllowed(predicate: DefaultProps["validate"], key: string) {
  if (!key) return false
  if (key.length > 1) return false
  if (typeof predicate === "string") return predicate.split("").includes(key)
  if (predicate instanceof Array) return predicate.includes(key)
  if (predicate instanceof RegExp) return predicate.test(key)
  return predicate(key)
}

// TODO: unit tests
function reducer(state: State, action: Action): State {
  const {format, validate} = state

  switch (action.type) {
    case "handle-key-down": {
      switch (action.key) {
        case "Unidentified":
        case "Dead": {
          const effectStack: Effect[] = [
            {type: "set-input-val", idx: state.focusIdx, val: ""},
            {type: "reject-key", idx: state.focusIdx, key: action.key},
            {type: "handle-code-change"},
          ]

          return {...state, effectStack}
        }

        case "ArrowLeft": {
          const prevFocusIdx = getPrevFocusIdx(state.focusIdx)
          const effectStack: Effect[] = [{type: "focus-input", idx: prevFocusIdx}]

          return {...state, focusIdx: prevFocusIdx, effectStack}
        }

        case "ArrowRight": {
          const nextFocusIdx = getNextFocusIdx(state.focusIdx, state.codeLength)
          const effectStack: Effect[] = [{type: "focus-input", idx: nextFocusIdx}]

          return {...state, focusIdx: nextFocusIdx, effectStack}
        }

        case "Backspace": {
          const prevFocusIdx = getPrevFocusIdx(state.focusIdx)
          const effectStack: Effect[] = [
            {type: "set-input-val", idx: state.focusIdx, val: ""},
            {type: "focus-input", idx: prevFocusIdx},
            {type: "handle-code-change"},
          ]

          return {...state, focusIdx: prevFocusIdx, codeCompleted: false, effectStack}
        }

        default: {
          if (!isKeyAllowed(validate, action.key)) {
            const effectStack: Effect[] = [
              {type: "reject-key", idx: state.focusIdx, key: action.key},
            ]

            return {...state, effectStack}
          }

          const nextFocusIdx = getNextFocusIdx(state.focusIdx, state.codeLength)
          const effectStack: Effect[] = [
            {type: "set-input-val", idx: state.focusIdx, val: format(action.key)},
            {type: "resolve-key", idx: state.focusIdx, key: action.key},
            {type: "focus-input", idx: nextFocusIdx},
            {type: "handle-code-change"},
          ]

          return {...state, focusIdx: nextFocusIdx, effectStack}
        }
      }
    }

    case "focus-input":
      return {...state, focusIdx: action.idx}

    case "mark-code-as-completed":
      return {...state, codeCompleted: true}

    default:
      return state
  }
}

const PinField: FC<Props> = props => {
  const {
    autoFocus,
    className,
    length: codeLength,
    validate,
    format,
    onResolveKey: handleResolveKey,
    onRejectKey: handleRejectKey,
    onChange: handleChange,
    onComplete: handleComplete,
    style,
    ...inputProps
  } = {...defaultProps, ...props}

  const idxs = [...Array(codeLength)].map((_, i) => i)
  const refs = useRef<HTMLInputElement[]>([])
  const [state, dispatch] = useReducer(reducer, {
    effectStack: [],
    focusIdx: 0,
    codeCompleted: false,
    codeLength,
    validate,
    format,
  })

  const setRef = useCallback((ref: HTMLInputElement) => refs.current.push(ref), [])
  const handleFocus = useCallback((idx: number) => () => dispatch({type: "focus-input", idx}), [])
  const handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (!IGNORED_META_KEYS.includes(evt.key) && !evt.altKey && !evt.ctrlKey) {
      evt.preventDefault()
      dispatch({type: "handle-key-down", key: evt.key})
    }
  }

  useEffect(() => {
    state.effectStack.forEach(eff => {
      switch (eff.type) {
        case "focus-input":
          refs.current[eff.idx].focus()
          break

        case "set-input-val": {
          const val = format(eff.val)
          refs.current[eff.idx].value = val
          if (val === "") refs.current[eff.idx].classList.remove("react-pin-field__input--success")
          break
        }

        case "resolve-key":
          refs.current[eff.idx].classList.remove("react-pin-field__input--error")
          refs.current[eff.idx].classList.add("react-pin-field__input--success")
          handleResolveKey(eff.key, refs.current[eff.idx])
          break

        case "reject-key":
          refs.current[eff.idx].value = ""
          refs.current[eff.idx].classList.remove("react-pin-field__input--success")
          refs.current[eff.idx].classList.add("react-pin-field__input--error")
          handleRejectKey(eff.key, refs.current[eff.idx])
          break

        case "handle-code-change": {
          const code = refs.current.map(r => r.value.trim()).join("")
          handleChange(code)

          if (!state.codeCompleted && code.length === codeLength) {
            handleComplete(code)
            dispatch({type: "mark-code-as-completed"})
          }

          break
        }

        default:
      }
    })
  }, [
    codeLength,
    format,
    handleChange,
    handleComplete,
    handleRejectKey,
    handleResolveKey,
    state.codeCompleted,
    state.effectStack,
  ])

  return (
    <>
      {idxs.map(idx => (
        <input
          type="text"
          {...inputProps}
          key={idx}
          ref={setRef}
          className={classNames("react-pin-field__input", className)}
          autoFocus={idx === 0 && autoFocus}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus(idx)}
          style={style}
          maxLength={1}
        />
      ))}
    </>
  )
}

export default PinField
