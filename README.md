  
# JSA  
  
An (esolang) javascript assembly implementation.  
  
  ***  
  
## Commands  
  
> How to read docs:  
  
```text
command parameter<> #this is a comment, all strings followed by <> or <type> are parameters, all other strings are static words
add [num<Number>=1]
sub [num<>=0] #wrapped in [] means optional (possible default value)
...params<> #multiple parameters
comm (a|b|c) #case group
```  
  
* `add [num<Number>=1]` - Add a number (or increment by 1 if null) to the accumulator.  
* `sub [num<Number>=1]` - Alias for negative `add`.  
* `mul [num<Number>=2]` - Multiply accumulator by a number.  
* `div [num<Number>=2]` - Alias for divisive `mul`.  
* `mod [num<Number>=2]` - Modulo.  
* `mov [to<Address>] from<Address>` - Move values.  
* `jmp label<String>` - Jump to label (same as writting to `jmx` but with labels instead of line nums).  
* `inc id<String>` - Include an external module. Use like `inc 'mod'` to include the local 'mod.jsa' or use resolvable path `inc '../path.jsa'`.  
* `slp [num<Number>=1]` - Sleep for `num` milliseconds.  
* `prt ...params<>` - Print to stdout.  
* `inp` - Read a character from stdin.  
* `if(e|l) [value<>=0]` - if `acc` (or symbol) is equal, less, greater, less-equal, greater-equal than 0 (or value).  
  
```plaintext
def name<String>
    #code<>
    #parameters passed are an array of: ...ARGS
    #acc of function scope will be linked to acc of caller
end
```  
  
* `[aw] functionName<String> [...params<>]` - call a custom function with params.  
* `scope<Scope>` - create an instance of an object.  
* `name<String>:` - add a `jmp` label.  
  
> Builtin objects are:  
>  
> * _math = Math  
> * _date = Date  
> * _process = process  
> * _require = require  
>  
> Other symbols:  
>  
> * jmx - current scoped jump position.  
> * jmb - last scoped jump position.  
> * acc - scoped accumulator, where operations happen.  
> * ENDL - OS-decided line terminator.  
> * WSPC - Whitespace.  
> * ARGS - Scope-passed arguments.  
> * null  
>  
> A symbol created inside a scope belongs only to that scope.  
> Address == Symbol == Variable  
> aw == await  
> Accessing properties & methods:  
> `M["prop"]`, `M.prop`, `M[val]`...  
> `M.method ...params`  
> Things can be `Number|String|Object|Array`  
> Weak typechecking is applied.  
  
## Staging  
  
* Variadic(?)  
  
### Deprecations  
  
* Functions and loops replaced by jumps.  
* Externals.  
* ifg, ifge, ifle.  
* Address from ops.  
* Variadics(?).  
* Async declaration.  
  
### Practices  
  
* Arrays should be like `[1,2,3]` and not `[1, 2, 3]` (mind the gap!)  
* Always escape string spaces with '\'  
  