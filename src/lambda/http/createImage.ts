import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import * as uuid from "uuid";

const docClient = new AWS.DynamoDB.DocumentClient();

const s3 = new AWS.S3({
    signatureVersion: 'v4'
})

const groupsTable = process.env.GROUPS_TABLE;
const imagesTable = process.env.IMAGES_TABLE;
const bucketName = process.env.IMAGES_S3_BUCKET;
const urlExpiration = Number.parseInt(process.env.SIGNED_URL_EXPIRATION)

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    console.log('Processing event', event);

    const groupId = event.pathParameters.groupId;

    const validGroupId = await groupExists(groupId);

    if(!validGroupId) 
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Group does not exist'
            })
        }
      

    const imageId = uuid.v4();
    const url = getUploadUrl(imageId);

    const newImage = JSON.parse(event.body);

    const newItem = {
        imageId,
        groupId,
        timestamp: new Date().toISOString(),
        imageUrl: `https://${bucketName}.s3.amazonaws.com/${imageId}`,
        ...newImage
    }

    await createImage(newItem);

    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            newItem,
            uploadUrl: url
        })
    }
}


async function groupExists(groupId: string) {
    const result = await docClient.get({
        TableName: groupsTable,
        Key: {
           id: groupId
        }
    }).promise();

    console.log('Get group ', result);
    return !!result.Item;
}

async function createImage(newItem) {
    return await docClient.put({
       TableName: imagesTable,
       Item: newItem
   }).promise()
   }

function getUploadUrl(imageId: String) {
    return s3.getSignedUrl('putObject', {
      Bucket: bucketName,
      Key: imageId,
      Expires: urlExpiration
    })
  }


