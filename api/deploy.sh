set -a
source ../.env
set +a
export COMPONENT=api
export AWS="aws --region $AWS_REGION --profile drfriendless --output text --no-cli-pager"

# upload code to S3
$AWS s3 cp $COMPONENT.zip s3://$DEPLOYMENT_BUCKET/

function update_lambda() {
    $AWS lambda update-function-code --function-name $1 --s3-bucket=$DEPLOYMENT_BUCKET --s3-key=$COMPONENT.zip --publish
}

#define_lambda "downloader-processUserList" "functions.processUserList"
#define_lambda "downloader-processUser" "functions.processUser"
#define_lambda "downloader-processCollection" "functions.processCollection"
#define_lambda "downloader-processGame" "functions.processGame"

cdk deploy --profile drfriendless --require-approval never
update_lambda "api_wartable"

date