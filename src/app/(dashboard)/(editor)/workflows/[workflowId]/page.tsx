import { requireAuth } from '@/lib/auth-utils';
import React from 'react'

interface PageProps{
    params: Promise<{
        workflowId: string
    }>
}

const page = async ( {params}: PageProps) => {
    
    await requireAuth();
    const { workflowId }= await params;

  return (
    <div>{workflowId}</div>
  )
}

export default page