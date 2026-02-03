// Ported from pocketbase/tools/mailer/html2text_test.go

import { describe, it } from "bun:test";
import { html2Text } from "./html2text.ts";

describe("html2Text", () => {
  it("converts html to text", () => {
    const scenarios = [
      { html: "", expected: "" },
      { html: "ab  c", expected: "ab c" },
      { html: "<!-- test html comment -->", expected: "" },
      { html: "<!-- test html comment -->   a   ", expected: "a" },
      { html: "<span>a</span>b<span>c</span>", expected: "abc" },
      { html: `<a href="a/b/c">test</span>`, expected: "[test](a/b/c)" },
      { html: `<a href="">test</span>`, expected: "[test]" },
      { html: "<span>a</span>  <span>b</span>", expected: "a b" },
      { html: "<span>a</span>   b   <span>c</span>", expected: "a b c" },
      { html: "<span>a</span>   b   <div>c</div>", expected: "a b \r\nc" },
      {
        html: `
				<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
				<html xmlns="http://www.w3.org/1999/xhtml">
				<head>
				    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
				    <meta name="viewport" content="width=device-width,initial-scale=1" />
				    <style>
				        body {
				            padding: 0;
				        }
				    </style>
				</head>
				<body>
					<!-- test html comment -->
					<style>
					    body {
					        padding: 0;
					    }
					</style>
				    <div class="wrapper">
				        <div class="content">
				            <p>Lorem ipsum</p>
				            <p>Dolor sit amet</p>
				            <p>
				            	<a href="a/b/c">Verify</a>
				            </p>
				            <br>
				            <p>
				            	<a href="a/b/c"><strong>Verify2.1</strong> <strong>Verify2.2</strong></a>
				            </p>
				            <br>
				            <br>
				            <div>
				            	<div>
				            		<div>
						            <ul>
					            		<li>ul.test1</li>
					            		<li>ul.test2</li>
					            		<li>ul.test3</li>
					            </ul>
					            <ol>
					            	<li>ol.test1</li>
					            	<li>ol.test2</li>
					            	<li>ol.test3</li>
					            </ol>
				            	</div>
				            	</div>
				            </div>
				            <select>
				            	<option>Option 1</option>
				            	<option>Option 2</option>
				            </select>
				            <textarea>test</textarea>
				            <input type="text" value="test" />
				            <button>test</button>
				            <p>
				                Thanks,<br/>
				                PocketBase team
				            </p>
				        </div>
				    </div>
				</body>
				</html>
			`,
        expected:
          "Lorem ipsum \r\nDolor sit amet \r\n[Verify](a/b/c)  \r\n[Verify2.1 Verify2.2](a/b/c)  \r\n\r\n- ul.test1 \r\n- ul.test2 \r\n- ul.test3  \r\n- ol.test1 \r\n- ol.test2 \r\n- ol.test3         \r\nThanks,\r\nPocketBase team",
      },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const [result, err] = html2Text(scenario.html);
      if (err) {
        throw new Error(`(${index}) Unexpected error ${err}`);
      }

      if (result !== scenario.expected) {
        throw new Error(
          `(${index}) Expected \n(${scenario.expected})\n${scenario.expected},\n\n got:\n\n(${result})\n${result}`,
        );
      }
    }
  });
});
