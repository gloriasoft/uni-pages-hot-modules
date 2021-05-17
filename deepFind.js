function deepFind (first, getChildren = () => {}, todo = () => {}) {
    if (todo(first) === false) {
        return
    }
    const children = getChildren(first)
    if (children) {
        children.forEach(child => deepFind(child, getChildren, todo))
    }
}

module.exports = deepFind
