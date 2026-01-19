#!/bin/env python3
# -*- coding: utf-8 -*-
# @Time    : 2020/10/16 15:13
# @Author  : Wang
import os
import requests
import json
import datetime
import time
import hmac
import hashlib
import base64
import urllib.parse
import subprocess

def ActionSend(secret,token,message):
    # 解码
    timestamp = str(round(time.time() * 1000))
    secret_enc = secret.encode('utf-8')
    string_to_sign = '{}\n{}'.format(timestamp, secret)
    string_to_sign_enc = string_to_sign.encode('utf-8')
    hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
    # 拼接
    url = "https://oapi.dingtalk.com/robot/send?access_token=%s&timestamp=%s&sign=%s" % (token,timestamp,sign)
    # 报文
    headers = {'content-type': "application/json"}
    body = {
        "msgtype": "markdown",
        "markdown": {
            "title": "云粒智慧-日照环保报警信息",
            "text": message
        },  
        "at": {
            "isAtAll": "false"
        }
    }
    #请求接口使用POST方式
    response = requests.post(url = url, headers = headers , json = body, timeout=5)
    # 返回信息
    #print (response.text)
    if response.status_code == 200:
        # 返回响应头
        #print (response.status_code)
        try:
            response_txt = response.text
            #转换返回的消息类型
            info = json.loads(response_txt)
            print (info)
        except OSError as e:
            return json.dumps({"status": 1, "info": "post-boot failed", "data": str(e)})
    else:
        return ("服务器未知错误")

if __name__ == "__main__":
    token="a963966f39724a314ee629986484de85ecbef388adbb0323404d36ac1bd7b2c2"
    secret='SEC862da1b77d52d3a30155f66eca2897bc636b2c7220d2de5c204b1f03751453cc'
    message="xxxx"
    ActionSend(secret=secret,token=token,message=message)
