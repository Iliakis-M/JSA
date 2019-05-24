  
# JSA  
  
An (esolang) javascript assembly implementation.  
  
  ***  
  
## Commands  
  
> How to read docs:  
  
```text
command parameter<> #this is a comment, all strings followed by <> or <type> are parameters, all other strings are static words#
add num<Number>
sub [num<>=0] #wrapped in [] means optional#
...params<> #multiple parameters#
comm (a|b|c) #case group#
```  
  
* `add [to<Address>=acc] [num<Number>=1]` - add a number (or increment by 1 if null) to the accumulator.  
* `sub [to<Address>=acc] [num<Number>=1]` - alias for negative `add`.  
* `mul [to<Address>=acc] num<Number>` - multiply accumulator by a number.  
* `div [to<Address>=acc] num<Number>` - alias for divisive `mul`.  
* `mov [to<Address>=acc] from<Address>`  
* `jmp label<String>` - jump to label.  
* `inc [to<Address>=acc] id<String>` - include an external module. Use like `inc M mod` to include the local 'mod.jsa' or use resolvable path `inc M ../path.jsa`.  
* `slp [num<Number>=1]` - Sleep for `num` ticks.  
* `moc [to<Address>=acc] from<Address>` - create an object out of a `dec` namespace.  
* `if(e|l|g|le|ge) [symbol<Address>=acc] [value<>=0]` - if `acc` (or symbol) is equal, less, greater, less-equal, greater-equal than 0 (or value).  
* create a function.  

```text
[asn] def name<String>
    #code<>#
    #parameters passed are an array of: ...args#
    #acc of function scope will be linked to acc of caller#
end
```  

* create a non-callable scope.  

```text
[ext] dec name<String>
    #code<>#
    #parameters passed are an array of: ...args#
    #acc of caller will be an object/scope#
end
```  

* `[aw] function<String> ...params<>` - call a custom function.  
* `name<String>:` - add a `jmp` label.  
  
> Builtin objects are:  
> * Math  
> * JSON  
  
> Other symbols:  
> * jmx - last scoped jump position.  
> * acc - scoped accumulator, where operations happen.  
  
> Address == Symbol == Variable  
> A symbol created inside a scope belongs only to that scope.  
> asn == async  
> aw == await  
> ext == export  
> Accessing properties & methods:
> `M.method ...params`  
> Things can be `Number|String|Object|Array`  
> Weak typechecking is applied.  
> Returned function value shall be in `acc`  
  