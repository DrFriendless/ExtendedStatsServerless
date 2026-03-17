set -a
source ../.env
set +a
export COMPONENT=api
export AWS="aws --region $AWS_REGION --profile drfriendless --output text --no-cli-pager"

# upload code to S3
$AWS s3 cp $COMPONENT.zip s3://$DEPLOYMENT_BUCKET/
# deploy the stack
cdk deploy --profile drfriendless --require-approval never
success=$?
if [ $success -eq 0 ]; then
    echo Code build succeeded
    # tell the Lambdas to refresh from their code source, because CloudFront is too special to do that.
    cd lib
    npx ts-node --prefer-ts-exts ./post-stack.mts
else
    echo CDK deploy failed, not proceeding.
    exit 3
fi
date