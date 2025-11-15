import { requireAuth } from '@/lib/auth-utils';
import React from 'react'

interface PageProps {
    params: Promise<{
        credentialId: string
    }>
}

const page = async ( { params }: PageProps ) => {

    await requireAuth();
    const { credentialId } = await params
  return (
    <div>{credentialId}</div>
  )
}

export default page