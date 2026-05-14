import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ScanCommand } from "@aws-sdk/client-dynamodb"; 
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { DeleteItemCommand } from "@aws-sdk/client-dynamodb";
const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});

export const handler = async (event) => {
    try {
        const method = event.requestContext?.http?.method;

        // 🔥 CORS
        if (method === "OPTIONS") {
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
                },
                body: ""
            };
        }
        // 📥 GET LIST (ดึงข้อมูลทั้งหมด)
            if (method === "GET" && event.rawQueryString === "list=true") {
            const result = await dynamo.send(new ScanCommand({
            TableName: "report"
         }));

            const items = result.Items.map(item => ({
            ticket_id: item.ticket_id.S,
            room: item.room.S,
            phone: item.phone?.S || "", 
            issue: item.issue.S,
            description: item.description.S,
            image_url: item.image_url.S,
            status: item.status.S
            }));

            return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(items)
            };
        }
        // 📸 STEP 1: GET → ขอ URL อัปโหลด
        if (method === "GET") {
            const fileName = `${Date.now()}.png`;

            const command = new PutObjectCommand({
                Bucket: "condo-image-report",
                Key: fileName,
                ContentType: "image/png"
            });

            const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

            const fileUrl = `https://condo-image-report.s3.ap-southeast-1.amazonaws.com/${fileName}`;

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    uploadUrl,
                    fileUrl
                })
            };
        }

        // 🗄️ STEP 2: POST → บันทึกข้อมูล
        if (method === "POST") {
            const body = JSON.parse(event.body);
            const ticket_id = Date.now().toString();

            const params = {
                TableName: "report",
                Item: {
                    ticket_id: { S: ticket_id },
                    room: { S: body.room },
                    phone: { S: body.phone || "" },
                    issue: { S: body.issue },
                    description: { S: body.description },
                    image_url: { S: body.image_url || "" },
                    status: { S: "pending" }
                }
            };

            await dynamo.send(new PutItemCommand(params));

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
                },
                body: JSON.stringify({ message: "success" })
            };
        }
        // 🔄 UPDATE STATUS (PUT)
        if (method === "PUT") {
        const body = JSON.parse(event.body);

        console.log("UPDATE:", body);

        await dynamo.send(new UpdateItemCommand({
        TableName: "report",
        Key: {
            ticket_id: { S: body.ticket_id }
        },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: {
            "#s": "status"
        },
        ExpressionAttributeValues: {
            ":s": { S: body.status }
        }
        }));

        return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
        },
        body: JSON.stringify({ message: "updated" })
        };
    }
        // ❌ DELETE
    if (method === "DELETE") {
    const body = JSON.parse(event.body);

    console.log("DELETE ID:", body.ticket_id); // debug

    await dynamo.send(new DeleteItemCommand({
        TableName: "report",
        Key: {
            ticket_id: { S: body.ticket_id }
        }
    }));

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify({ message: "deleted" })
    };
}

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};