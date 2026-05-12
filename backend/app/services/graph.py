def topological_order(definition):
    nodes = {n["id"] for n in definition["nodes"]}
    indeg = {n: 0 for n in nodes}
    adj = {n: [] for n in nodes}
    for e in definition["edges"]:
        adj[e["from"]].append(e["to"])
        indeg[e["to"]] += 1
    q = [n for n in nodes if indeg[n] == 0]
    order = []
    while q:
        n = q.pop(0)
        order.append(n)
        for m in adj[n]:
            indeg[m] -= 1
            if indeg[m] == 0:
                q.append(m)
    if len(order) != len(nodes):
        raise ValueError("Cycle detected")
    return order