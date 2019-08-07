import isArray from 'lodash-es/isArray'

function patch(db) {
  return function sendPatch(patch) {
    if (!patch) {
      return
    }
    if (!isArray(patch)) {
      patch = [patch]
    }
    return db.patch(patch)
  }
}

export default patch
