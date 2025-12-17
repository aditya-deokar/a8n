"use client"

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import BaseExecutionNode from "../base-execution-node";
import {  GlobeIcon } from "lucide-react";
import { useState } from "react";
import HttpRequestDialog, { FormType } from "./dialog";

type HttpRequestNodeData ={
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: string;
    [key: string]: unknown;
}

type HttpRequestNodeType = Node<HttpRequestNodeData>



const HttpRequestNode = (props: NodeProps<HttpRequestNodeType>) => {

  const [dialogOpen, setDialogOpen] = useState(false)
  const{ setNodes }=useReactFlow()

  const nodeStatus= "initial";

  const handleOpenSettings = ()=> setDialogOpen(true);

  const handleSubmit = (values:FormType)=>{
    setNodes((nodes)=> nodes.map((node)=> {
      if(node.id === props.id){
        return {
          ...node,
          data: {
              ...node.data,
            endpoint: values.endpoint,
            method:values.method,
            body:values.body
          }
        } 
      }

      return node;
    }))
  }

    const nodeData = props.data;
    const description = nodeData?.endpoint ? `${nodeData.method || "GET"} : ${nodeData.endpoint}` : "Not Configured"

  return (
    <>
        <HttpRequestDialog
          onSubmit={handleSubmit}
          defaultMethod={nodeData.method}
          defaultBody={nodeData.body}
          defualtEndpoint={nodeData.endpoint}
          onOpenChange={setDialogOpen} open={dialogOpen}/>
         <BaseExecutionNode
            {...props}
            id={props.id}
            icon={GlobeIcon}
            name="HTTP Request"
            description={description}
            onSettings={handleOpenSettings}
            onDoubleClick={handleOpenSettings}
            status={nodeStatus}
         />
    </>
  )
}

export default HttpRequestNode