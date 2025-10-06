# thank you Toby Fleming
# https://tobywf.com/2017/09/aws-lambda-code-storage-limit-exceeded/

from __future__ import absolute_import, print_function, unicode_literals
import boto3


def clean_old_lambda_versions():
    client = boto3.client('lambda')
    functions = client.list_functions()['Functions']
    for function in functions:
        versions = client.list_versions_by_function(FunctionName=function['FunctionArn'])['Versions']
        for version in versions:
            if version['Version'] != function['Version']:
                arn = version['FunctionArn']
                print('delete_function(FunctionName={})'.format(arn))
                #client.delete_function(FunctionName=arn)  # uncomment me once you've checked


if __name__ == '__main__':
    clean_old_lambda_versions()