import React, { useState } from 'react'
import { Button, Card, Input, Select } from 'antd'
import { useVeramo } from '@veramo-community/veramo-react'
import { useQuery } from 'react-query'
import { IIdentifier } from '@veramo/core'
import { issueCredential } from './utils/signing'
import { v4 } from 'uuid'
import { PageContainer } from '@ant-design/pro-components'
const { TextArea } = Input
const { Option } = Select

const CreateProfileCredential: React.FC = () => {
  const { agent } = useVeramo()

  const { data: identifiers, isLoading: identifiersLoading } = useQuery(
    ['identifiers', { agentId: agent?.context.id }],
    () => agent?.didManagerFind(),
  )
  // Only allow did:ethr:sepolia identifiers
  const filteredIdentifiers = identifiers?.filter((id: IIdentifier) => id.did.startsWith('did:ethr:sepolia')) || [];
  // Remove proofFormat state and always use EthereumEip712Signature2021
  const proofFormat = 'EthereumEip712Signature2021';
  const [issuer, setIssuer] = useState<string>('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [recipient, setRecipient] = useState('')
  const [inFlight, setInFlight] = useState(false)

  return (
    <PageContainer>
      <Card>
        <Select
          style={{ width: '60%' }}
          loading={identifiersLoading}
          onChange={(e: string) => setIssuer(e)}
          placeholder="issuer DID (did:ethr:sepolia only)"
          defaultActiveFirstOption={true}
        >
          {filteredIdentifiers.map((id: IIdentifier) => (
            <Option key={id.did} value={id.did as string}>
              {id.did}
            </Option>
          ))}
        </Select>
        <Input placeholder="Name" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
        <TextArea placeholder="Bio" onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)} />
        <br />
        <br />
        <Input
          placeholder="Recipient DID"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
        />
        <br />
        <br />
        <Button
          type="primary"
          disabled={inFlight || !issuer}
          onClick={async () => {
            try {
              setInFlight(true)
              const cred = await issueCredential(
                agent,
                issuer,
                issuer,
                [
                  { type: 'name', value: name },
                  { type: 'bio', value: bio },
                ],
                proofFormat,
                '',
                'ProfileCredentialSchema',
                'did:web:veramo.io;id=62a8ca5d-7e78-4e7b-a2c1-0bf2d37437ad;version=1.0',
              )
              console.log('cred: ', cred)
              if (recipient) {
                const packedMessage = await agent?.packDIDCommMessage({
                  packing: 'none',
                  message: {
                    from: issuer,
                    to: recipient,
                    id: v4(),
                    type: 'w3c.vc',
                    body: cred,
                  },
                })
                console.log('packedMessage: ', packedMessage)
                const res = await agent?.sendDIDCommMessage({
                  messageId: v4(),
                  packedMessage,
                  recipientDidUrl: recipient,
                })
                console.log('res: ', res)
              }
              setInFlight(false)
            } catch (ex) {
              console.error('ex: ', ex)
              setInFlight(false)
            }
          }}
        >
          Create Profile
        </Button>
      </Card>
    </PageContainer>
  )
}

export default CreateProfileCredential
