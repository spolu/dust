use anyhow::{anyhow, Result};
use deno_core::{
    op2, serde_v8, v8, Extension, JsRuntime, OpDecl, OpState, PollEventLoopOptions, RuntimeOptions,
};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::borrow::Cow;
use std::rc::Rc;
use std::time::Duration;
use tokio::sync::Mutex;

#[derive(Debug)]
struct ResultResource {
    json_value: serde_json::Value,
}

// Type that is stored inside Deno's resource table
impl deno_core::Resource for ResultResource {
    fn name(&self) -> Cow<str> {
        "__rust_result".into()
    }
}

#[op2(fast)]
fn op_return(state: &mut OpState, #[string] value: &str) -> Result<(), deno_core::error::AnyError> {
    let value: serde_json::Value = serde_json::from_str(value)?;
    let entry = ResultResource { json_value: value };
    let resource_table = &mut state.resource_table;
    let _rid = resource_table.add(entry);
    Ok(())
}

pub struct Script {
    runtime: JsRuntime,
    last_rid: u32,
    timeout: Option<Duration>,
}

impl Script {
    const DEFAULT_FILENAME: &'static str = "code_block.js";

    pub fn from_string(js_code: &str) -> Result<Self> {
        // console.log() is not available by default -- add the most basic version with single
        // argument (and no warn/info/... variants)
        let all_code = "let __rust_logs = [];
            const console = { log: function(...args) {
                __rust_logs = __rust_logs.concat(args)
            } };"
            .to_string()
            + js_code;

        Self::create_script(all_code)
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        assert!(self.timeout.is_none());
        assert!(timeout > Duration::ZERO);

        self.timeout = Some(timeout);
        self
    }

    fn create_script(js_code: String) -> Result<Self> {
        const DECL: OpDecl = op_return();
        let ext = Extension {
            name: "script",
            ops: std::borrow::Cow::Borrowed(&[DECL]),
            ..Default::default()
        };

        let options = deno_core::RuntimeOptions {
            // module_loader: Some(Rc::new(deno_core::FsModuleLoader)),
            extensions: vec![ext],
            ..Default::default()
        };

        let mut runtime = JsRuntime::new(options);

        // We cannot provide a dynamic filename because execute_script() requires a &'static str
        runtime.execute_script(Self::DEFAULT_FILENAME, js_code)?;

        Ok(Script {
            runtime,
            last_rid: 0,
            timeout: None,
        })
    }

    pub fn call<A, R>(&mut self, fn_name: &str, arg: A) -> Result<(R, Vec<serde_json::Value>)>
    where
        A: Serialize,
        R: DeserializeOwned,
    {
        let json_arg = serde_json::to_value(arg)?.to_string();
        let (json_result, logs) = self.call_impl(fn_name, json_arg)?;
        let result: R = serde_json::from_value(json_result)?;

        Ok((result, logs))
    }

    fn call_impl(
        &mut self,
        fn_name: &str,
        json_args: String,
    ) -> Result<(serde_json::Value, Vec<serde_json::Value>)> {
        // Note: ops() is required to initialize internal state
        // Wrap everything in scoped block

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0");

        // 'undefined' will cause JSON serialization error, so it needs to be treated as null
        let js_code = format!(
            "(async () => {{
				let __rust_result = {fn_name}.constructor.name === 'AsyncFunction'
					? await {fn_name}({json_args})
					: {fn_name}({json_args});

				if (typeof __rust_result === 'undefined')
					__rust_result = null;

				Deno.core.ops.op_return(JSON.stringify({{value: __rust_result, logs: __rust_logs}}));
			}})()"
        );

        // println!("CALLING SCRIPT:\n{}", js_code);

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 1");

        if let Some(timeout) = self.timeout {
            let handle = self.runtime.v8_isolate().thread_safe_handle();

            tokio::task::spawn(async move {
                tokio::time::sleep(timeout).await;
                handle.terminate_execution();
            });
        }

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 2");

        // syncing ops is required cause they sometimes change while preparing the engine
        // self.runtime.sync_ops_cache();

        // TODO use strongly typed JsError here (downcast)
        self.runtime
            .execute_script(Self::DEFAULT_FILENAME, js_code)?;
        deno_core::futures::executor::block_on(
            self.runtime.run_event_loop(PollEventLoopOptions::default()),
        )?;

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 3");

        let state_rc = self.runtime.op_state();
        let mut state = state_rc.borrow_mut();
        let table = &mut state.resource_table;

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 4");
        println!("last_rid: {}", self.last_rid);

        // Get resource, and free slot (no longer needed)
        let entry: Rc<ResultResource> = table
            .take(self.last_rid)
            .expect("Resource entry must be present");
        let extracted =
            Rc::try_unwrap(entry).expect("Rc must hold single strong ref to resource entry");
        self.last_rid += 1;

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 5");

        let output = extracted.json_value;

        let return_value = output["value"].clone();

        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 6");

        println!("output: {:?}", output);

        match output.get("logs") {
            Some(serde_json::Value::Array(logs)) => Ok((return_value, logs.clone())),
            _ => Ok((return_value, vec![])),
        }
    }
}

impl Drop for Script {
    fn drop(&mut self) {
        // This is required to free resources
        println!("Dropping script <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct ValueWithLogs<R> {
    value: R,
    logs: Vec<serde_json::Value>,
}

pub fn call<A>(
    js_code: &str,
    fn_name: &str,
    arg: A,
    timeout: Option<Duration>,
) -> Result<(serde_json::Value, Vec<serde_json::Value>)>
where
    A: Serialize,
    // R: DeserializeOwned + std::fmt::Debug,
{
    let json_args = serde_json::to_value(arg)?.to_string();
    // let (json_result, logs) = self.call_impl(fn_name, json_arg)?;
    // let result: R = serde_json::from_value(json_result)?;

    let code = format!(
        "let __rust_logs = [];
         const console = {{ log: function(...args) {{
            __rust_logs = __rust_logs.concat(args)
        }} }};

        {js_code}

        (async () => {{
			let __rust_result = {fn_name}.constructor.name === 'AsyncFunction'
				? await {fn_name}({json_args})
				: {fn_name}({json_args});

			if (typeof __rust_result === 'undefined')
				__rust_result = null;

            return {{value: __rust_result, logs: __rust_logs}};
		}})()"
    );

    let mut runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(deno_core::FsModuleLoader)),
        ..Default::default()
    });

    // inline definition of a type { value: R, logs: Vec<serde_json::Value> }
    //
    let promise = runtime.execute_script("code_block.js", code)?;

    // if let Some(timeout) = timeout {
    //     let handle = runtime.v8_isolate().thread_safe_handle();

    //     tokio::task::spawn(async move {
    //         tokio::time::sleep(timeout).await;
    //         handle.terminate_execution();
    //     });
    // }

    #[allow(deprecated)]
    let value = deno_core::futures::executor::block_on(runtime.resolve_value(promise))?;
    // let value = runtime.resolve_value(promise).await?;

    let ok = runtime.v8_isolate().cancel_terminate_execution();
    println!("ok: {:?}", ok);

    let scope = &mut runtime.handle_scope();
    let local = v8::Local::new(scope, value);
    // Deserialize a `v8` object into a Rust type using `serde_v8`,
    // in this case deserialize to a JSON `Value`.
    let result = serde_v8::from_v8::<ValueWithLogs<serde_json::Value>>(scope, local);
    //Ok((serde_json::Value::Null, vec![]))
    //

    match result {
        Ok(r) => {
            println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 6");
            println!("value: {:?}", r.value);
            Ok((r.value, r.logs))
        }
        Err(err) => Err(anyhow!("Code block deserialization error: {err:?}")),
    }
}

pub async fn safe_async_call<A>(
    js_code: &str,
    fn_name: &str,
    arg: A,
    timeout: Option<Duration>,
) -> Result<(serde_json::Value, Vec<serde_json::Value>)>
where
    A: Serialize + Clone,
    // R: DeserializeOwned + std::fmt::Debug,
{
    let json_args = serde_json::to_value(arg)?.to_string();
    let code = format!(
        "let __rust_logs = [];
         const console = {{ log: function(...args) {{
            __rust_logs = __rust_logs.concat(args)
        }} }};

        {js_code}

        (async () => {{
			let __rust_result = {fn_name}.constructor.name === 'AsyncFunction'
				? await {fn_name}({json_args})
				: {fn_name}({json_args});

			if (typeof __rust_result === 'undefined')
				__rust_result = null;

            return {{value: __rust_result, logs: __rust_logs}};
		}})()"
    );

    let r = {
        let local = tokio::task::LocalSet::new();
        let r =
            local
                .run_until(async move {
                    let r = tokio::task::spawn_local(async move {
                // let (json_result, logs) = self.call_impl(fn_name, json_arg)?;
                // let result: R = serde_json::from_value(json_result)?;

                let mut runtime = JsRuntime::new(RuntimeOptions {
                    module_loader: Some(Rc::new(deno_core::FsModuleLoader)),
                    ..Default::default()
                });

                // inline definition of a type { value: R, logs: Vec<serde_json::Value> }
                //
                let promise = runtime.execute_script("code_block.js", code)?;

                // if let Some(timeout) = timeout {
                //     let handle = runtime.v8_isolate().thread_safe_handle();

                //     tokio::task::spawn(async move {
                //         tokio::time::sleep(timeout).await;
                //         handle.terminate_execution();
                //     });
                // }

                #[allow(deprecated)]
                let value = runtime.resolve_value(promise).await?;

                let ok = runtime.v8_isolate().cancel_terminate_execution();
                println!("ok: {:?}", ok);

                let scope = &mut runtime.handle_scope();
                let local = v8::Local::new(scope, value);
                // Deserialize a `v8` object into a Rust type using `serde_v8`,
                // in this case deserialize to a JSON `Value`.
                let result = serde_v8::from_v8::<ValueWithLogs<serde_json::Value>>(scope, local);
                //Ok((serde_json::Value::Null, vec![]))
                //

                match result {
                    Ok(r) => {
                        println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 6");
                        println!("value: {:?}", r.value);
                        Ok((r.value.clone(), r.logs.clone()))
                    }
                    Err(err) => Err(anyhow!("Code block deserialization error: {err:?}")),
                }
            })
            .await?;
                    r
                })
                .await?;
        r
    };

    Ok(r)
}

pub async fn async_call<A>(
    js_code: &str,
    fn_name: &str,
    arg: A,
    timeout: Option<Duration>,
) -> Result<(serde_json::Value, Vec<serde_json::Value>)>
where
    A: Serialize,
    // R: DeserializeOwned + std::fmt::Debug,
{
    let json_args = serde_json::to_value(arg)?.to_string();
    // let (json_result, logs) = self.call_impl(fn_name, json_arg)?;
    // let result: R = serde_json::from_value(json_result)?;

    let code = format!(
        "let __rust_logs = [];
         const console = {{ log: function(...args) {{
            __rust_logs = __rust_logs.concat(args)
        }} }};

        {js_code}

        (async () => {{
			let __rust_result = {fn_name}.constructor.name === 'AsyncFunction'
				? await {fn_name}({json_args})
				: {fn_name}({json_args});

			if (typeof __rust_result === 'undefined')
				__rust_result = null;

            return {{value: __rust_result, logs: __rust_logs}};
		}})()"
    );

    let mut runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(deno_core::FsModuleLoader)),
        ..Default::default()
    });

    // inline definition of a type { value: R, logs: Vec<serde_json::Value> }
    //
    let promise = runtime.execute_script("code_block.js", code)?;

    // if let Some(timeout) = timeout {
    //     let handle = runtime.v8_isolate().thread_safe_handle();

    //     tokio::task::spawn(async move {
    //         tokio::time::sleep(timeout).await;
    //         handle.terminate_execution();
    //     });
    // }

    #[allow(deprecated)]
    let value = runtime.resolve_value(promise).await?;

    // let ok = runtime.v8_isolate().cancel_terminate_execution();
    // println!("ok: {:?}", ok);

    let result = {
        let scope = &mut runtime.handle_scope();
        let local = v8::Local::new(scope, value);
        // Deserialize a `v8` object into a Rust type using `serde_v8`,
        // in this case deserialize to a JSON `Value`.
        serde_v8::from_v8::<ValueWithLogs<serde_json::Value>>(scope, local)
    };
    //Ok((serde_json::Value::Null, vec![]))
    //
    println!(">>>>> DROPPING");
    drop(runtime);
    println!(">>>>> DROPED");

    match result {
        Ok(r) => {
            println!("HERE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 6");
            println!("value: {:?}", r.value);
            Ok((r.value, r.logs))
        }
        Err(err) => Err(anyhow!("Code block deserialization error: {err:?}")),
    }
}
