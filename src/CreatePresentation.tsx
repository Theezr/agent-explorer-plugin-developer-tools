import React, { useState } from 'react'
import {
  Typography,
  Form,
  Input,
  Button,
  Select,
  Row,
  Card,
  Table,
  Tag,
} from 'antd'
import { signVerifiablePresentation } from './utils/signing'
import { useVeramo } from '@veramo-community/veramo-react'

import { useQuery } from 'react-query'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { IDIDManager, ProofFormat } from '@veramo/core'
import { ICredentialIssuer } from '@veramo/credential-w3c'
import { ISelectiveDisclosure } from '@veramo/selective-disclosure'
import { PageContainer } from '@ant-design/pro-components'

const { Option } = Select

const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 4 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 20 },
  },
}

interface DataType {
  hash: string
  verifiableCredential: any
}

const historyColumns = [
  {
    title: 'Issuance Date',
    dataIndex: 'verifiableCredential',
    sorter: {
      compare: (a: any, b: any) =>
        new Date(a.verifiableCredential.issuanceDate).getTime() -
        new Date(b.verifiableCredential.issuanceDate).getTime(),
      multiple: 1,
    },
    render: (verifiableCredential: any) =>
      format(new Date(verifiableCredential.issuanceDate), 'PPP'),
  },
  {
    title: 'Type',
    dataIndex: 'verifiableCredential',
    render: (verifiableCredential: any) =>
      verifiableCredential.type.map((type: string, i: number) => (
        <Tag color="geekblue" key={i}>
          {type}
        </Tag>
      )),
  },
]

const CreatePresentation: React.FC = () => {
  const { agent } = useVeramo<
    ICredentialIssuer & IDIDManager & ISelectiveDisclosure,
    any
  >()
  if (!agent) throw Error('No agent')
  const [selectedCredentials, setSelectedCredentials] = useState<any[]>([])
  const [sending] = useState<boolean>(false)
  const [issuer, setIssuer] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const { data: credentials, isLoading: credentialHistoryLoading } = useQuery(
    ['credentials'],
    () => agent?.dataStoreORMGetVerifiableCredentials(),
  )
  const { data: identifiers, isLoading: identifiersLoading } = useQuery(
    ['identifiers', { agentId: agent?.context.id }],
    () => agent?.didManagerFind(),
  )
  // Only allow did:ethr:sepolia identifiers
  const filteredIdentifiers =
    identifiers?.filter((id: any) => id.did.startsWith('did:ethr:sepolia')) ||
    []
  // Remove proofFormat state and always use EthereumEip712Signature2021
  const proofFormat: ProofFormat = 'EthereumEip712Signature2021'
  const rowSelection = {
    onChange: (selectedRowKeys: React.Key[], selectedRows: DataType[]) => {
      setSelectedCredentials(
        selectedRows.map((row) => row.verifiableCredential),
      )
    },
  }

  const signVP = async (send?: boolean) => {
    const vp = await signVerifiablePresentation(
      agent,
      issuer,
      [subject],
      selectedCredentials,
      proofFormat, // always EthereumEip712Signature2021
    )

    setIssuer('')
    setSubject('')
    setSelectedCredentials([])

    if (send) {
      await sendVP(vp)
    }
  }

  const sendVP = async (body: any) => {
    try {
      const messageId = uuidv4()
      const message = {
        type: 'veramo.io/chat/v1/basicmessage',
        to: subject as string,
        from: issuer as string,
        id: messageId,
        body: body,
      }
      const packedMessage = await agent?.packDIDCommMessage({
        packing: 'authcrypt',
        message: message,
      })
      if (packedMessage) {
        await agent?.sendDIDCommMessage({
          messageId: messageId,
          packedMessage,
          recipientDidUrl: subject as string,
        })
      }
    } catch (err) {
      console.log(err)
      agent?.handleMessage({ raw: body.proof.jwt, save: true })
    }
  }

  return (
    <PageContainer>
      <Card bordered={false}>
        <Typography.Text>
          Select credentials to create presentation
        </Typography.Text>
        <br />
        <br />
        <Form.Item noStyle>
          <Input
            value={subject}
            placeholder="verifier DID"
            style={{ width: '60%', marginBottom: 15 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSubject(e.target.value)
            }
          />
        </Form.Item>
        <Form.Item>
          <Select
            style={{ width: '60%' }}
            loading={identifiersLoading}
            onChange={(e: string) => setIssuer(e)}
            placeholder="issuer DID (did:ethr:sepolia only)"
            defaultActiveFirstOption={true}
          >
            {filteredIdentifiers.map((id: { did: string }) => (
              <Option key={id.did} value={id.did as string}>
                {id.did}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Row>
          <Button
            type="primary"
            onClick={() => signVP()}
            style={{ marginRight: 5 }}
            disabled={
              sending || selectedCredentials.length === 0 || !subject || !issuer
            }
          >
            Create Presentation
          </Button>
          <Button
            onClick={() => signVP(true)}
            type="primary"
            disabled={
              sending || selectedCredentials.length === 0 || !subject || !issuer
            }
          >
            Create Presentation & Send
          </Button>
        </Row>
      </Card>
      <Form {...formItemLayout}>
        <Form.Item noStyle>
          <div>
            <Table
              loading={credentialHistoryLoading}
              rowSelection={rowSelection}
              expandable={{
                expandedRowRender: (record) => (
                  <pre>
                    {JSON.stringify(
                      record.verifiableCredential.credentialSubject,
                      null,
                      2,
                    )}
                  </pre>
                ),
              }}
              rowKey={(record) => record.hash}
              columns={historyColumns}
              dataSource={credentials}
              pagination={false}
            />
          </div>
        </Form.Item>
      </Form>
    </PageContainer>
  )
}

export default CreatePresentation
