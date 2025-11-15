import { requireAuth } from '@/lib/auth-utils';
import React from 'react'

interface PageProps {
    params: Promise<{
        executionId: string
    }>
}

const page = async ( { params }: PageProps ) => {

  await requireAuth();
  const { executionId}= await params;

  return (
    <div>{executionId}</div>
  )
}

export default page