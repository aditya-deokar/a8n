import { Connection, Node } from "@/generated/prisma/client";
import { th } from "date-fns/locale";
import toposort from "toposort";


export const toplogicalSort =(
    nodes: Node[],
    connections: Connection[],

): Node[] => {
    // if no connections, return node as is (they are all independent)
    if(connections.length === 0){
        return nodes;
    }


    // create edges array for toposort
    const edges: [string, string][] = connections.map((conn)=> [
        conn.fromNodeId,
        conn.toNodeId,
    ]);

    // Add nodes with no connections as self-edges to ensure they are included
    const connectedNodeIds = new Set<string>();

    for(const conn of connections) {
        connectedNodeIds.add(conn.fromNodeId);
        connectedNodeIds.add(conn.toNodeId);
    }

    for(const node of nodes){
        if(!connectedNodeIds.has(node.id)){
            edges.push([node.id, node.id]);
        }
    }


    // Perform topological sort
    let sortedNodeIds: string[];
    try{
        sortedNodeIds= toposort(edges);
        // remove duplicates (from self-edges)
        sortedNodeIds= [...new Set(sortedNodeIds)];
    } catch (error){ 
        if (error instanceof Error && error.message.includes("Cyclic")){
            throw new Error("Workflow contains a cycle")
        }
        throw error;
    }

    // Map sorted IDs back to node objects
    const nodeMap= new Map(nodes.map((n)=> [n.id, n]));

    return sortedNodeIds.map((id)=> nodeMap.get(id)!).filter(Boolean);

}

